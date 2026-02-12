import { log } from "../../shared/logger"
import type {
	LinearIssue,
	LinearMcpClient,
	PlanProgress,
	TrackingStateProvider,
} from "./types"
import { extractDoneStateId, extractIssue, isIssueCompleted } from "./linear-response-parser"

type ProviderConfig = {
	teamId: string
	labelPrefix: string
}

const LOG_PREFIX = "[linear-provider]"
const SAFE_PROGRESS: PlanProgress = {
	total: 0,
	completed: 0,
	isComplete: true,
}

export function createLinearStateProvider(
	client: LinearMcpClient,
	config: ProviderConfig,
): TrackingStateProvider {
	let doneStateId: string | null | undefined

	async function loadIssue(issueId: string): Promise<LinearIssue | null> {
		const response = await client.callTool("get_issue", { issueId })
		return extractIssue(response)
	}

	async function ensureDoneStateId(): Promise<string | null> {
		if (doneStateId !== undefined) return doneStateId
		try {
			const response = await client.callTool("get_workflow_states", {
				teamId: config.teamId,
			})
			doneStateId = extractDoneStateId(response)
			return doneStateId
		} catch (error) {
			log(`${LOG_PREFIX} get_workflow_states failed`, {
				teamId: config.teamId,
				error,
			})
			doneStateId = null
			return null
		}
	}

	return {
		type: "linear",

		async getProgress(planRef: string): Promise<PlanProgress> {
			try {
				const issue = await loadIssue(planRef)
				if (!issue) return SAFE_PROGRESS
				const subIssues = issue.subIssues ?? []
				const completed = subIssues.filter(isIssueCompleted).length
				const parentDone = isIssueCompleted(issue)
				const allSubDone = subIssues.length > 0 && completed === subIssues.length
				return {
					total: subIssues.length,
					completed,
					isComplete: parentDone || allSubDone,
				}
			} catch (error) {
				log(`${LOG_PREFIX} getProgress failed`, { planRef, error })
				return SAFE_PROGRESS
			}
		},

		async markTaskComplete(planRef: string, taskId: string): Promise<void> {
			try {
				const completedStateId = await ensureDoneStateId()
				if (!completedStateId) {
					log(`${LOG_PREFIX} missing completed workflow state`, {
						planRef,
						taskId,
					})
					return
				}
				await client.callTool("update_issue", {
					issueId: taskId,
					stateId: completedStateId,
				})
			} catch (error) {
				log(`${LOG_PREFIX} markTaskComplete failed`, {
					planRef,
					taskId,
					error,
				})
			}
		},

		async isComplete(planRef: string): Promise<boolean> {
			try {
				const issue = await loadIssue(planRef)
				if (!issue) return true
				if (isIssueCompleted(issue)) return true
				const subIssues = issue.subIssues ?? []
				if (subIssues.length === 0) return false
				return subIssues.every(isIssueCompleted)
			} catch (error) {
				log(`${LOG_PREFIX} isComplete failed`, { planRef, error })
				return true
			}
		},
	}
}
