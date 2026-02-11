import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import { HOOK_NAME } from "./constants"
import type { LoopStateController, RalphLoopEventHandlerOptions } from "./types"
import {
	transitionToNextIssue,
	buildNextIssueContinuationPrompt,
	buildRefreshSearchPrompt,
} from "./next-issue-transition"
import { injectContinuationPrompt } from "./continuation-prompt-injector"

interface LinearCompletionArgs {
	ctx: PluginInput
	sessionID: string
	options: RalphLoopEventHandlerOptions
}

export async function handleLinearIssueCompletion(args: LinearCompletionArgs): Promise<boolean> {
	const { ctx, sessionID, options } = args

	if (!options.trackingProvider?.findNextOpenIssueId) return false

	const nextIssueId = options.trackingProvider.findNextOpenIssueId()

	if (nextIssueId) {
		return handleNextIssueTransition(ctx, sessionID, nextIssueId, options)
	}

	return handleCacheExhausted(ctx, sessionID, options)
}

async function handleNextIssueTransition(
	ctx: PluginInput,
	sessionID: string,
	nextIssueId: string,
	options: RalphLoopEventHandlerOptions,
): Promise<boolean> {
	log(`[${HOOK_NAME}] Found next Linear issue, continuing loop`, { sessionID, nextIssueId })
	transitionToNextIssue(options.directory, nextIssueId)

	const newState = options.loopState.incrementIteration()
	if (newState) {
		try {
			await injectContinuationPrompt(ctx, {
				sessionID,
				prompt: buildNextIssueContinuationPrompt(nextIssueId, newState, options.directory),
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
	return true
}

async function handleCacheExhausted(
	ctx: PluginInput,
	sessionID: string,
	options: RalphLoopEventHandlerOptions,
): Promise<boolean> {
	log(`[${HOOK_NAME}] No cached issues left, injecting refresh search prompt`, { sessionID })
	const refreshState = options.loopState.incrementIteration()
	if (!refreshState) return false

	try {
		await injectContinuationPrompt(ctx, {
			sessionID,
			prompt: buildRefreshSearchPrompt(refreshState),
			directory: options.directory,
			apiTimeoutMs: options.apiTimeoutMs,
		})
	} catch (err) {
		log(`[${HOOK_NAME}] Failed to inject refresh search continuation`, {
			sessionID,
			error: String(err),
		})
	}
	return true
}
