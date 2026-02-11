import type { RalphLoopState } from "./types"
import { readBoulderState, writeBoulderState } from "../../features/boulder-state"
import { setActiveIssue, readShadowCache } from "../../features/linear-state/shadow-cache"

export function transitionToNextIssue(directory: string, nextIssueId: string): void {
	const boulder = readBoulderState(directory)
	if (!boulder) return
	boulder.linear_issue_id = nextIssueId
	boulder.active_plan = nextIssueId
	boulder.plan_name = nextIssueId
	writeBoulderState(directory, boulder)
	setActiveIssue(directory, nextIssueId)
}

function getStartedStateIdFromCache(directory: string): string | null {
	const cache = readShadowCache(directory)
	return cache?.workflow_states?.started_state_id ?? null
}

export function buildNextIssueContinuationPrompt(
	nextIssueId: string,
	state: RalphLoopState,
	directory?: string,
): string {
	const prefix = state.ultrawork ? "ultrawork " : ""
	const startedStateId = directory ? getStartedStateIdFromCache(directory) : null
	const updateStatusStep = startedStateId
		? `2. Update the issue status to "In Progress" via \`update_issue\` with stateId: "${startedStateId}"`
		: `2. Call \`get_workflow_states\` to find the "started" state ID, then update the issue status to "In Progress" via \`update_issue\``
	return `${prefix}[SYSTEM DIRECTIVE - RALPH LOOP ${state.iteration}/${state.max_iterations}]

Current issue completed. Moving to next Linear issue: ${nextIssueId}

INSTRUCTIONS:
1. Use Linear MCP \`get_issue\` to fetch the full details of issue ${nextIssueId}
${updateStatusStep}
3. Read sub-issues and execute them one by one
4. Mark each sub-issue as "Done" via \`update_issue\` when completed
5. When ALL sub-issues are done, the loop will automatically pick the next open issue
6. When FULLY complete and no more issues remain, output: <promise>${state.completion_promise}</promise>`
}

export function buildRefreshSearchPrompt(state: RalphLoopState): string {
	const prefix = state.ultrawork ? "ultrawork " : ""
	return `${prefix}[SYSTEM DIRECTIVE - RALPH LOOP ${state.iteration}/${state.max_iterations}]

All cached Linear issues have been completed. Searching for remaining open issues...

INSTRUCTIONS:
1. Call Linear MCP \`search_issues\` to find any remaining open issues for the team
2. If open issues are found: pick the first one, update it to "In Progress" via \`update_issue\`, and begin execution
3. If NO open issues remain: all work is done — output: <promise>${state.completion_promise}</promise>

The shadow cache will be auto-updated from the search results.`
}
