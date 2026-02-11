import type { PlanProgress, TrackingStateProvider } from "./types"
import { isIssueCompleted } from "./linear-response-parser"
import {
	readShadowCache,
	upsertIssueInCache,
	findNextOpenIssueId,
} from "./shadow-cache"
import { log } from "../../shared/logger"

const LOG_PREFIX = "[linear-shadow-provider]"

export function createLinearShadowCacheProvider(
	directory: string,
): TrackingStateProvider & { findNextOpenIssueId: () => string | null } {
	return {
		type: "linear",

		async getProgress(planRef: string): Promise<PlanProgress> {
			const cache = readShadowCache(directory)
			if (!cache) return { total: 0, completed: 0, isComplete: true }

			const issue = cache.issues[planRef]
			if (!issue) return { total: 0, completed: 0, isComplete: true }

			const subIssues = issue.subIssues ?? []
			if (subIssues.length === 0) {
				return {
					total: isIssueCompleted(issue) ? 1 : 1,
					completed: isIssueCompleted(issue) ? 1 : 0,
					isComplete: isIssueCompleted(issue),
				}
			}

			const completed = subIssues.filter(isIssueCompleted).length
			return {
				total: subIssues.length,
				completed,
				isComplete: isIssueCompleted(issue) || completed === subIssues.length,
			}
		},

		async markTaskComplete(planRef: string, taskId: string): Promise<void> {
			const cache = readShadowCache(directory)
			if (!cache) return

			const issue = cache.issues[planRef]
			if (!issue) return

			const subIssue = issue.subIssues?.find(
				(s) => s.identifier === taskId || s.id === taskId,
			)
			if (subIssue) {
				subIssue.state = {
					...subIssue.state,
					type: "completed",
					name: "Done",
				}
				upsertIssueInCache(directory, issue)
				log(`${LOG_PREFIX} marked sub-issue complete in cache`, {
					planRef,
					taskId,
				})
			}
		},

		async isComplete(planRef: string): Promise<boolean> {
			const cache = readShadowCache(directory)
			if (!cache) return true

			const issue = cache.issues[planRef]
			if (!issue) return true

			if (isIssueCompleted(issue)) return true

			const subIssues = issue.subIssues ?? []
			if (subIssues.length === 0) return false

			return subIssues.every(isIssueCompleted)
		},

		findNextOpenIssueId(): string | null {
			return findNextOpenIssueId(directory)
		},
	}
}
