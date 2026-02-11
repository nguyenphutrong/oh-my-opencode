import {
	findPrometheusPlans,
	getPlanProgress,
	getPlanName,
} from "../../features/boulder-state"
import { readShadowCache } from "../../features/linear-state/shadow-cache"
import type { LinearShadowCache } from "../../features/linear-state/shadow-cache-types"
import { isIssueCompleted } from "../../features/linear-state/linear-response-parser"

export interface PlanCandidate {
	id: string
	name: string
	completed: number
	total: number
	isComplete: boolean
	provider: "markdown" | "linear"
}

export function discoverMarkdownPlans(directory: string): PlanCandidate[] {
	const plans = findPrometheusPlans(directory)
	return plans.map((planPath) => {
		const progress = getPlanProgress(planPath)
		return {
			id: planPath,
			name: getPlanName(planPath),
			completed: progress.completed,
			total: progress.total,
			isComplete: progress.isComplete,
			provider: "markdown" as const,
		}
	})
}

export function discoverLinearIssues(directory: string): PlanCandidate[] {
	const cache = readShadowCache(directory)
	if (!cache) return []
	return extractCandidatesFromCache(cache)
}

function extractCandidatesFromCache(cache: LinearShadowCache): PlanCandidate[] {
	const candidates: PlanCandidate[] = []

	for (const id of cache.open_issue_ids) {
		const issue = cache.issues[id]
		if (!issue) continue
		if (isIssueCompleted(issue)) continue

		const subIssues = issue.subIssues ?? []
		const completed = subIssues.filter(isIssueCompleted).length
		candidates.push({
			id: issue.identifier,
			name: issue.title,
			completed,
			total: subIssues.length,
			isComplete: false,
			provider: "linear",
		})
	}

	return candidates
}

export function findPlanByName(plans: string[], requestedName: string): string | null {
	const lowerName = requestedName.toLowerCase()

	const exactMatch = plans.find((p) => getPlanName(p).toLowerCase() === lowerName)
	if (exactMatch) return exactMatch

	const partialMatch = plans.find((p) => getPlanName(p).toLowerCase().includes(lowerName))
	return partialMatch || null
}
