import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import type { RalphLoopOptions, RalphLoopState } from "./types"
import type { TrackingStateProvider } from "../../features/linear-state/types"
import { HOOK_NAME } from "./constants"
import {
	detectCompletionInSessionMessages,
	detectCompletionInTranscript,
} from "./completion-promise-detector"
import { buildContinuationPrompt } from "./continuation-prompt-builder"
import { injectContinuationPrompt } from "./continuation-prompt-injector"
import { readBoulderState, writeBoulderState } from "../../features/boulder-state"
import { setActiveIssue } from "../../features/linear-state/shadow-cache"

type SessionRecovery = {
	isRecovering: (sessionID: string) => boolean
	markRecovering: (sessionID: string) => void
	clear: (sessionID: string) => void
}
type LoopStateController = { getState: () => RalphLoopState | null; clear: () => boolean; incrementIteration: () => RalphLoopState | null }
type RalphLoopEventHandlerOptions = { directory: string; apiTimeoutMs: number; getTranscriptPath: (sessionID: string) => string | undefined; checkSessionExists?: RalphLoopOptions["checkSessionExists"]; sessionRecovery: SessionRecovery; loopState: LoopStateController; trackingProvider?: TrackingStateProvider & { findNextOpenIssueId?: () => string | null } }

export function createRalphLoopEventHandler(
	ctx: PluginInput,
	options: RalphLoopEventHandlerOptions,
) {
	return async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
		const props = event.properties as Record<string, unknown> | undefined

		if (event.type === "session.idle") {
			const sessionID = props?.sessionID as string | undefined
			if (!sessionID) return

			if (options.sessionRecovery.isRecovering(sessionID)) {
				log(`[${HOOK_NAME}] Skipped: in recovery`, { sessionID })
				return
			}

			const state = options.loopState.getState()
			if (!state || !state.active) {
				return
			}

			if (state.session_id && state.session_id !== sessionID) {
				if (options.checkSessionExists) {
					try {
						const exists = await options.checkSessionExists(state.session_id)
						if (!exists) {
							options.loopState.clear()
							log(`[${HOOK_NAME}] Cleared orphaned state from deleted session`, {
								orphanedSessionId: state.session_id,
								currentSessionId: sessionID,
							})
							return
						}
					} catch (err) {
						log(`[${HOOK_NAME}] Failed to check session existence`, {
							sessionId: state.session_id,
							error: String(err),
						})
					}
				}
				return
			}

			const transcriptPath = options.getTranscriptPath(sessionID)
			const completionViaTranscript = detectCompletionInTranscript(transcriptPath, state.completion_promise)
			const completionViaApi = completionViaTranscript
				? false
				: await detectCompletionInSessionMessages(ctx, {
					sessionID,
					promise: state.completion_promise,
					apiTimeoutMs: options.apiTimeoutMs,
					directory: options.directory,
				})
			const completionViaTracking = !completionViaTranscript && !completionViaApi && state.plan_ref && options.trackingProvider
				? await options.trackingProvider.isComplete(state.plan_ref).catch(() => false)
				: false

			if (completionViaTranscript || completionViaApi || completionViaTracking) {
				log(`[${HOOK_NAME}] Completion detected!`, {
					sessionID,
					iteration: state.iteration,
					promise: state.completion_promise,
					detectedVia: completionViaTranscript
						? "transcript_file"
						: completionViaApi
							? "session_messages_api"
							: "tracking_provider",
				})

				if (completionViaTracking && options.trackingProvider?.findNextOpenIssueId) {
					const nextIssueId = options.trackingProvider.findNextOpenIssueId()
					if (nextIssueId) {
						log(`[${HOOK_NAME}] Found next Linear issue, continuing loop`, {
							sessionID,
							nextIssueId,
						})
						transitionToNextIssue(options.directory, nextIssueId)
						const newState = options.loopState.incrementIteration()
						if (newState) {
							try {
								await injectContinuationPrompt(ctx, {
									sessionID,
									prompt: buildNextIssueContinuationPrompt(nextIssueId, newState),
									directory: options.directory,
									apiTimeoutMs: options.apiTimeoutMs,
								})
							} catch (err) {
								log(`[${HOOK_NAME}] Failed to inject next-issue continuation`, {
									sessionID,
									error: String(err),
								})
							}
						}
						return
					}
				}

				options.loopState.clear()

				const title = state.ultrawork ? "ULTRAWORK LOOP COMPLETE!" : "Ralph Loop Complete!"
				const message = state.ultrawork ? `JUST ULW ULW! Task completed after ${state.iteration} iteration(s)` : `Task completed after ${state.iteration} iteration(s)`
				await ctx.client.tui.showToast({ body: { title, message, variant: "success", duration: 5000 } }).catch(() => {})
				return
			}

			if (state.iteration >= state.max_iterations) {
				log(`[${HOOK_NAME}] Max iterations reached`, {
					sessionID,
					iteration: state.iteration,
					max: state.max_iterations,
				})
				options.loopState.clear()

				await ctx.client.tui
					.showToast({
						body: { title: "Ralph Loop Stopped", message: `Max iterations (${state.max_iterations}) reached without completion`, variant: "warning", duration: 5000 },
					})
					.catch(() => {})
				return
			}

			const newState = options.loopState.incrementIteration()
			if (!newState) {
				log(`[${HOOK_NAME}] Failed to increment iteration`, { sessionID })
				return
			}

			log(`[${HOOK_NAME}] Continuing loop`, {
				sessionID,
				iteration: newState.iteration,
				max: newState.max_iterations,
			})

			await ctx.client.tui
				.showToast({
					body: {
						title: "Ralph Loop",
						message: `Iteration ${newState.iteration}/${newState.max_iterations}`,
						variant: "info",
						duration: 2000,
					},
				})
				.catch(() => {})

			try {
				await injectContinuationPrompt(ctx, {
					sessionID,
					prompt: buildContinuationPrompt(newState),
					directory: options.directory,
					apiTimeoutMs: options.apiTimeoutMs,
				})
			} catch (err) {
				log(`[${HOOK_NAME}] Failed to inject continuation`, {
					sessionID,
					error: String(err),
				})
			}
			return
		}

		if (event.type === "session.deleted") {
			const sessionInfo = props?.info as { id?: string } | undefined
			if (!sessionInfo?.id) return
			const state = options.loopState.getState()
			if (state?.session_id === sessionInfo.id) {
				options.loopState.clear()
				log(`[${HOOK_NAME}] Session deleted, loop cleared`, { sessionID: sessionInfo.id })
			}
			options.sessionRecovery.clear(sessionInfo.id)
			return
		}

		if (event.type === "session.error") {
			const sessionID = props?.sessionID as string | undefined
			const error = props?.error as { name?: string } | undefined

			if (error?.name === "MessageAbortedError") {
				if (sessionID) {
					const state = options.loopState.getState()
					if (state?.session_id === sessionID) {
						options.loopState.clear()
						log(`[${HOOK_NAME}] User aborted, loop cleared`, { sessionID })
					}
					options.sessionRecovery.clear(sessionID)
				}
				return
			}

			if (sessionID) {
				options.sessionRecovery.markRecovering(sessionID)
			}
		}
	}
}

function transitionToNextIssue(directory: string, nextIssueId: string): void {
	const boulder = readBoulderState(directory)
	if (!boulder) return
	boulder.linear_issue_id = nextIssueId
	boulder.active_plan = nextIssueId
	boulder.plan_name = nextIssueId
	writeBoulderState(directory, boulder)
	setActiveIssue(directory, nextIssueId)
}

function buildNextIssueContinuationPrompt(
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

