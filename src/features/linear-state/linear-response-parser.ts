import type { LinearIssue } from "./types"

export function extractIssue(value: unknown): LinearIssue | null {
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractIssue(item)
			if (found) return found
		}
		return null
	}
	if (!isRecord(value)) return null
	const state = extractState(value.state)
	const id = getString(value.id)
	const title = getString(value.title)
	if (!state || !id || !title) {
		for (const nested of Object.values(value)) {
			const found = extractIssue(nested)
			if (found) return found
		}
		return null
	}
	const labelsRaw = Array.isArray(value.labels) ? value.labels : []
	const labels = labelsRaw
		.filter(isRecord)
		.map((label) => ({
			id: getString(label.id) ?? "",
			name: getString(label.name) ?? "",
		}))
		.filter((label) => label.id.length > 0 || label.name.length > 0)
	const subIssuesRaw = Array.isArray(value.subIssues) ? value.subIssues : []
	const subIssues = subIssuesRaw
		.map(extractIssue)
		.filter((issue): issue is LinearIssue => issue !== null)
	return {
		id,
		identifier: getString(value.identifier) ?? id,
		title,
		description: getString(value.description) ?? "",
		state,
		labels,
		subIssues,
	}
}

export function extractDoneStateId(value: unknown): string | null {
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractDoneStateId(item)
			if (found) return found
		}
		return null
	}
	if (!isRecord(value)) return null
	const state = extractState(value)
	if (state?.type === "completed") return state.id
	for (const nested of Object.values(value)) {
		const found = extractDoneStateId(nested)
		if (found) return found
	}
	return null
}

function extractState(value: unknown): LinearIssue["state"] | null {
	if (!isRecord(value)) return null
	const id = getString(value.id)
	const name = getString(value.name)
	const type = getString(value.type)
	if (!id || !name || !isStateType(type)) return null
	return { id, name, type }
}

export function isIssueCompleted(issue: LinearIssue): boolean {
	return issue.state.type === "completed"
}

function isStateType(value: string | null): value is LinearIssue["state"]["type"] {
	return (
		value === "backlog" ||
		value === "unstarted" ||
		value === "started" ||
		value === "completed" ||
		value === "canceled"
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function getString(value: unknown): string | null {
	return typeof value === "string" ? value : null
}
