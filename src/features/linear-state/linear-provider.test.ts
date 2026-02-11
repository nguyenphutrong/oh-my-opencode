import { describe, expect, test, mock } from "bun:test"
import { createLinearStateProvider } from "./linear-provider"
import type { LinearMcpClient, LinearIssue } from "./types"

describe("createLinearStateProvider", () => {
	const config = {
		teamId: "TEAM1",
		labelPrefix: "task:",
	}

	function createMockClient() {
		const callTool = mock((name: string, args: Record<string, unknown>) => {
			return Promise.resolve({})
		})
		return {
			callTool,
			asClient: () => ({ callTool }) as unknown as LinearMcpClient,
		}
	}

	test("getProgress returns correct counts from sub-issues", async () => {
		//#given
		const mockClient = createMockClient()
		const issue: LinearIssue = {
			id: "parent-id",
			identifier: "PAR-1",
			title: "Parent",
			description: "",
			state: { id: "todo", name: "Todo", type: "unstarted" },
			labels: [],
			subIssues: [
				{
					id: "sub-1",
					identifier: "SUB-1",
					title: "Sub 1",
					description: "",
					state: { id: "done", name: "Done", type: "completed" },
					labels: [],
				},
				{
					id: "sub-2",
					identifier: "SUB-2",
					title: "Sub 2",
					description: "",
					state: { id: "todo", name: "Todo", type: "unstarted" },
					labels: [],
				},
			],
		}
		mock.module("./linear-response-parser", () => ({
			extractIssue: () => issue,
			isIssueCompleted: (i: LinearIssue) => i.state.type === "completed",
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		const progress = await provider.getProgress("parent-id")

		//#then
		expect(progress.total).toBe(2)
		expect(progress.completed).toBe(1)
		expect(progress.isComplete).toBe(false)
	})

	test("getProgress returns safe progress on API failure", async () => {
		//#given
		const mockClient = createMockClient()
		mockClient.callTool.mockImplementation(() => Promise.reject(new Error("API Error")))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		const progress = await provider.getProgress("parent-id")

		//#then
		expect(progress.total).toBe(0)
		expect(progress.completed).toBe(0)
		expect(progress.isComplete).toBe(true)
	})

	test("isComplete returns true when parent issue is completed", async () => {
		//#given
		const mockClient = createMockClient()
		const issue: LinearIssue = {
			id: "parent-id",
			identifier: "PAR-1",
			title: "Parent",
			description: "",
			state: { id: "done", name: "Done", type: "completed" },
			labels: [],
			subIssues: [],
		}
		mock.module("./linear-response-parser", () => ({
			extractIssue: () => issue,
			isIssueCompleted: (i: LinearIssue) => i.state.type === "completed",
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		const complete = await provider.isComplete("parent-id")

		//#then
		expect(complete).toBe(true)
	})

	test("isComplete returns true when all sub-issues are completed", async () => {
		//#given
		const mockClient = createMockClient()
		const issue: LinearIssue = {
			id: "parent-id",
			identifier: "PAR-1",
			title: "Parent",
			description: "",
			state: { id: "todo", name: "Todo", type: "unstarted" },
			labels: [],
			subIssues: [
				{
					id: "sub-1",
					identifier: "SUB-1",
					title: "Sub 1",
					description: "",
					state: { id: "done", name: "Done", type: "completed" },
					labels: [],
				},
			],
		}
		mock.module("./linear-response-parser", () => ({
			extractIssue: () => issue,
			isIssueCompleted: (i: LinearIssue) => i.state.type === "completed",
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		const complete = await provider.isComplete("parent-id")

		//#then
		expect(complete).toBe(true)
	})

	test("isComplete returns false when some sub-issues are incomplete", async () => {
		//#given
		const mockClient = createMockClient()
		const issue: LinearIssue = {
			id: "parent-id",
			identifier: "PAR-1",
			title: "Parent",
			description: "",
			state: { id: "todo", name: "Todo", type: "unstarted" },
			labels: [],
			subIssues: [
				{
					id: "sub-1",
					identifier: "SUB-1",
					title: "Sub 1",
					description: "",
					state: { id: "todo", name: "Todo", type: "unstarted" },
					labels: [],
				},
			],
		}
		mock.module("./linear-response-parser", () => ({
			extractIssue: () => issue,
			isIssueCompleted: (i: LinearIssue) => i.state.type === "completed",
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		const complete = await provider.isComplete("parent-id")

		//#then
		expect(complete).toBe(false)
	})

	test("markTaskComplete calls update_issue with correct stateId", async () => {
		//#given
		const mockClient = createMockClient()
		mockClient.callTool.mockImplementation((name: string) => {
			if (name === "get_workflow_states") {
				return Promise.resolve({ data: { workflowStates: { nodes: [{ id: "done-id", type: "completed" }] } } })
			}
			return Promise.resolve({})
		})
		mock.module("./linear-response-parser", () => ({
			extractDoneStateId: () => "done-id",
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		await provider.markTaskComplete("parent-id", "task-id")

		//#then
		expect(mockClient.callTool).toHaveBeenCalledWith("update_issue", {
			issueId: "task-id",
			stateId: "done-id",
		})
	})

	test("markTaskComplete handles missing done state gracefully", async () => {
		//#given
		const mockClient = createMockClient()
		mockClient.callTool.mockImplementation(() => Promise.resolve({}))
		mock.module("./linear-response-parser", () => ({
			extractDoneStateId: () => null,
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		await provider.markTaskComplete("parent-id", "task-id")

		//#then
		expect(mockClient.callTool).not.toHaveBeenCalledWith("update_issue", expect.any(Object))
	})

	test("Lazy caching: get_workflow_states only called once across multiple operations", async () => {
		//#given
		const mockClient = createMockClient()
		mockClient.callTool.mockImplementation((name: string) => {
			if (name === "get_workflow_states") {
				return Promise.resolve({ nodes: [{ id: "done-id", type: "completed" }] })
			}
			return Promise.resolve({})
		})
		mock.module("./linear-response-parser", () => ({
			extractDoneStateId: () => "done-id",
		}))
		const provider = createLinearStateProvider(mockClient.asClient(), config)

		//#when
		await provider.markTaskComplete("parent-id", "task-1")
		await provider.markTaskComplete("parent-id", "task-2")

		//#then
		const workflowCalls = mockClient.callTool.mock.calls.filter((call) => call[0] === "get_workflow_states")
		expect(workflowCalls.length).toBe(1)
	})
})
