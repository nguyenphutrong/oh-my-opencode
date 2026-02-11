import type { LinearIssue } from "./types"

export interface LinearShadowCache {
	active_issue_id: string | null
	team_id: string
	issues: Record<string, LinearIssue>
	workflow_states: {
		done_state_id: string | null
		started_state_id: string | null
	}
	/** Identifiers from last search_issues — used for "find next open issue" */
	open_issue_ids: string[]
	last_updated: string
}

export const EMPTY_SHADOW_CACHE: LinearShadowCache = {
	active_issue_id: null,
	team_id: "",
	issues: {},
	workflow_states: {
		done_state_id: null,
		started_state_id: null,
	},
	open_issue_ids: [],
	last_updated: new Date().toISOString(),
}
