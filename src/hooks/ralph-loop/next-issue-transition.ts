import type { RalphLoopState } from "./types"
import { readBoulderState, writeBoulderState } from "../../features/boulder-state"
import { setActiveIssue } from "../../features/linear-state/shadow-cache"

export function transitionToNextIssue(directory: string, nextIssueId: string): void {
	const boulder = readBoulderState(directory)
	if (!boulder) return
	boulder.linear_issue_id = nextIssueId
	boulder.active_plan = nextIssueId
	boulder.plan_name = nextIssueId
	writeBoulderState(directory, boulder)
	setActiveIssue(directory, nextIssueId)
}

export function buildNextIssueContinuationPrompt(
	nextIssueId: string,
	state: RalphLoopState,
): string {
	const prefix = state.ultrawork ? "ultrawork " : ""
	return `${prefix}[SYSTEM DIRECTIVE - RALPH LOOP ${state.iteration}/${state.max_iterations}]

Current issue completed. Moving to next Linear issue: ${nextIssueId}

INSTRUCTIONS:
1. Use Linear MCP \`get_issue\` to fetch the full details of issue ${nextIssueId}
2. Update the issue status to "In Progress" via \`update_issue\`
3. Read sub-issues and execute them one by one
4. Mark each sub-issue as "Done" via \`update_issue\` when completed
5. When ALL sub-issues are done, the loop will automatically pick the next open issue
6. When FULLY complete and no more issues remain, output: <promise>${state.completion_promise}</promise>`
}
