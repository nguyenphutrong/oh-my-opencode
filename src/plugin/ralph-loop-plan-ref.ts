import { readBoulderState } from "../features/boulder-state"

export function resolveLinearPlanRef(directory: string): string | undefined {
	const boulder = readBoulderState(directory)
	if (!boulder) return undefined
	if (boulder.tracking_provider === "linear" && boulder.linear_issue_id) {
		return boulder.linear_issue_id
	}
	return boulder.active_plan ?? undefined
}
