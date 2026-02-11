import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readShadowCache } from "../../features/linear-state/shadow-cache";
import { createLinearMcpInterceptorHook } from "./interceptor-hook";

function makeSkillMcpBeforeInput(sessionID: string, callID: string) {
	return { tool: "skill_mcp", sessionID, callID };
}

describe("createLinearMcpInterceptorHook", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "linear-mcp-interceptor-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("ignores non-skill_mcp tools", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);

		//#when
		await hook["tool.execute.before"](
			{ tool: "bash", sessionID: "s1", callID: "c1" },
			{
				args: {
					mcp_name: "linear",
					tool_name: "get_issue",
					arguments: { id: "1" },
				},
			},
		);
		await hook["tool.execute.after"](
			{ tool: "bash", sessionID: "s1", callID: "c1" },
			{ title: "done", output: JSON.stringify({}), metadata: {} },
		);

		//#then
		expect(readShadowCache(testDir)).toBeNull();
	});

	test("ignores non-linear MCPs", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);

		//#when
		await hook["tool.execute.before"](makeSkillMcpBeforeInput("s2", "c2"), {
			args: {
				mcp_name: "github",
				tool_name: "get_issue",
				arguments: { id: "1" },
			},
		});
		await hook["tool.execute.after"](
			{ tool: "skill_mcp", sessionID: "s2", callID: "c2" },
			{
				title: "done",
				output: JSON.stringify({
					id: "issue-1",
					identifier: "OMO-401",
					title: "Issue",
					state: { id: "todo", name: "Todo", type: "unstarted" },
				}),
				metadata: {},
			},
		);

		//#then
		expect(readShadowCache(testDir)).toBeNull();
	});

	test("tool.execute.before stores pending call for linear skill_mcp and after consumes it", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);
		const issueResponse = {
			id: "issue-2",
			identifier: "OMO-402",
			title: "Issue 402",
			description: "",
			state: { id: "todo", name: "Todo", type: "unstarted" },
			labels: [],
		};

		//#when
		await hook["tool.execute.before"](makeSkillMcpBeforeInput("s3", "c3"), {
			args: {
				mcp_name: "linear",
				tool_name: "get_issue",
				arguments: { id: "issue-2" },
			},
		});
		await hook["tool.execute.after"](
			{ tool: "skill_mcp", sessionID: "s3", callID: "c3" },
			{ title: "done", output: JSON.stringify(issueResponse), metadata: {} },
		);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache).not.toBeNull();
		expect(Object.keys(cache?.issues ?? {}).length).toBeGreaterThan(0);
	});

	test("tool.execute.after processes get_issue response and updates cache", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);

		//#when
		await hook["tool.execute.before"](makeSkillMcpBeforeInput("s4", "c4"), {
			args: {
				mcp_name: "linear",
				tool_name: "get_issue",
				arguments: { id: "issue-3" },
			},
		});
		await hook["tool.execute.after"](
			{ tool: "skill_mcp", sessionID: "s4", callID: "c4" },
			{
				title: "done",
				output: JSON.stringify({
					data: {
						issue: {
							id: "issue-3",
							identifier: "OMO-403",
							title: "Issue 403",
							description: "",
							state: { id: "todo", name: "Todo", type: "unstarted" },
							labels: [],
						},
					},
				}),
				metadata: {},
			},
		);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache).not.toBeNull();
		expect(Object.keys(cache?.issues ?? {}).length).toBeGreaterThan(0);
	});

	test("tool.execute.after processes update_issue response and updates cache", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);

		//#when
		await hook["tool.execute.before"](makeSkillMcpBeforeInput("s5", "c5"), {
			args: {
				mcp_name: "linear",
				tool_name: "update_issue",
				arguments: { id: "issue-4" },
			},
		});
		await hook["tool.execute.after"](
			{ tool: "skill_mcp", sessionID: "s5", callID: "c5" },
			{
				title: "done",
				output: JSON.stringify({
					issue: {
						id: "issue-4",
						identifier: "OMO-404",
						title: "Issue 404",
						description: "",
						state: { id: "done", name: "Done", type: "completed" },
						labels: [],
					},
				}),
				metadata: {},
			},
		);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache).not.toBeNull();
		expect(Object.keys(cache?.issues ?? {}).length).toBeGreaterThan(0);
	});

	test("tool.execute.after processes search_issues and updates open_issue_ids", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);
		const searchOutput = {
			issues: [
				{
					id: "issue-5",
					identifier: "OMO-405",
					title: "Open Issue",
					description: "",
					state: { id: "todo", name: "Todo", type: "started" },
					labels: [],
				},
				{
					id: "issue-6",
					identifier: "OMO-406",
					title: "Done Issue",
					description: "",
					state: { id: "done", name: "Done", type: "completed" },
					labels: [],
				},
			],
		};

		//#when
		await hook["tool.execute.before"](makeSkillMcpBeforeInput("s6", "c6"), {
			args: {
				mcp_name: "linear",
				tool_name: "search_issues",
				arguments: { query: "OMO" },
			},
		});
		await hook["tool.execute.after"](
			{ tool: "skill_mcp", sessionID: "s6", callID: "c6" },
			{ title: "done", output: JSON.stringify(searchOutput), metadata: {} },
		);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache?.open_issue_ids.length ?? 0).toBeGreaterThan(0);
	});

	test("tool.execute.after processes get_workflow_states and updates workflow state IDs", async () => {
		//#given
		const hook = createLinearMcpInterceptorHook(testDir);
		const workflowOutput = {
			data: {
				workflowStates: {
					nodes: [
						{ id: "state-started", name: "In Progress", type: "started" },
						{ id: "state-done", name: "Done", type: "completed" },
					],
				},
			},
		};

		//#when
		await hook["tool.execute.before"](makeSkillMcpBeforeInput("s7", "c7"), {
			args: {
				mcp_name: "linear",
				tool_name: "get_workflow_states",
				arguments: {},
			},
		});
		await hook["tool.execute.after"](
			{ tool: "skill_mcp", sessionID: "s7", callID: "c7" },
			{ title: "done", output: JSON.stringify(workflowOutput), metadata: {} },
		);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache?.workflow_states.done_state_id).not.toBeNull();
		expect(cache?.workflow_states).toBeDefined();
	});
});
