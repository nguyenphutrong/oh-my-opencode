import type { PlanProgress, TrackingStateProvider } from "./types"
import { createMarkdownStateProvider } from "./markdown-provider"
import { createLinearShadowCacheProvider } from "./shadow-cache-provider"
import { readBoulderState } from "../boulder-state/storage"

export function createAutoTrackingProvider(
	directory: string,
): TrackingStateProvider & { findNextOpenIssueId: () => string | null } {
	const markdownProvider = createMarkdownStateProvider()
	const linearProvider = createLinearShadowCacheProvider(directory)

	function isLinearActive(): boolean {
		const boulder = readBoulderState(directory)
		return boulder?.tracking_provider === "linear"
	}

	return {
		get type() {
			return isLinearActive() ? "linear" as const : "markdown" as const
		},

		async getProgress(planRef: string): Promise<PlanProgress> {
			return isLinearActive()
				? linearProvider.getProgress(planRef)
				: markdownProvider.getProgress(planRef)
		},

		async markTaskComplete(planRef: string, taskId: string): Promise<void> {
			return isLinearActive()
				? linearProvider.markTaskComplete(planRef, taskId)
				: markdownProvider.markTaskComplete(planRef, taskId)
		},

		async isComplete(planRef: string): Promise<boolean> {
			return isLinearActive()
				? linearProvider.isComplete(planRef)
				: markdownProvider.isComplete(planRef)
		},

		findNextOpenIssueId(): string | null {
			return linearProvider.findNextOpenIssueId()
		},
	}
}
