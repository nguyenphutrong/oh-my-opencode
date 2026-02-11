import type { LinearIssue } from "../../features/linear-state/types"
import { extractIssue, extractDoneStateId } from "../../features/linear-state/linear-response-parser"
import { matchesLinearName } from "../../features/linear-state/detection"
import {
	upsertIssueInCache,
	updateOpenIssueIds,
	setWorkflowStates,
	readShadowCache,
	writeShadowCache,
} from "../../features/linear-state/shadow-cache"
import { EMPTY_SHADOW_CACHE } from "../../features/linear-state/shadow-cache-types"
import { log } from "../../shared/logger"

const LOG_PREFIX = "[linear-mcp-interceptor]"

interface PendingCall {
	mcpName: string
	toolName: string
	args: Record<string, unknown>
	storedAt: number
}

const pendingCalls = new Map<string, PendingCall>()
const STALE_MS = 5 * 60 * 1000

function makeKey(sessionID: string, callID: string): string {
	return `${sessionID}:${callID}`
}

function cleanupStale(): void {
	const now = Date.now()
	for (const [key, entry] of pendingCalls) {
		if (now - entry.storedAt > STALE_MS) pendingCalls.delete(key)
	}
}

export function createLinearMcpInterceptorHook(directory: string) {
	return {
		"tool.execute.before": async (
			input: { tool: string; sessionID: string; callID: string },
			output: { args: Record<string, unknown> },
		): Promise<void> => {
			if (input.tool !== "skill_mcp") return

			const mcpName = typeof output.args.mcp_name === "string" ? output.args.mcp_name : ""
			if (!matchesLinearName(mcpName)) return

			const toolName = typeof output.args.tool_name === "string" ? output.args.tool_name : ""
			if (!toolName) return

			cleanupStale()
			const rawArgs = output.args.arguments
			const parsedArgs: Record<string, unknown> =
				typeof rawArgs === "string" ? safeJsonParse(rawArgs) :
				typeof rawArgs === "object" && rawArgs !== null ? rawArgs as Record<string, unknown> :
				{}

			pendingCalls.set(makeKey(input.sessionID, input.callID), {
				mcpName,
				toolName,
				args: parsedArgs,
				storedAt: Date.now(),
			})
		},

		"tool.execute.after": async (
			input: { tool: string; sessionID: string; callID: string },
			output: { title: string; output: string; metadata: Record<string, unknown> },
		): Promise<void> => {
			if (input.tool !== "skill_mcp") return

			const key = makeKey(input.sessionID, input.callID)
			const pending = pendingCalls.get(key)
			if (!pending) return
			pendingCalls.delete(key)

			try {
				const responseData = safeJsonParse(output.output)
				handleLinearResponse(directory, pending.toolName, pending.args, responseData)
			} catch (error) {
				log(`${LOG_PREFIX} failed to process response`, {
					toolName: pending.toolName,
					error: String(error),
				})
			}
		},
	}
}

function handleLinearResponse(
	directory: string,
	toolName: string,
	args: Record<string, unknown>,
	response: Record<string, unknown>,
): void {
	switch (toolName) {
		case "get_issue": {
			const issue = extractIssue(response)
			if (issue) {
				upsertIssueInCache(directory, issue)
				log(`${LOG_PREFIX} cached issue`, { identifier: issue.identifier })
			}
			break
		}
		case "update_issue": {
			const issue = extractIssue(response)
			if (issue) {
				upsertIssueInCache(directory, issue)
				log(`${LOG_PREFIX} updated cached issue`, { identifier: issue.identifier })
			}
			break
		}
		case "search_issues": {
			const issues = extractIssuesFromSearch(response)
			if (issues.length > 0) {
				updateOpenIssueIds(directory, issues)
				log(`${LOG_PREFIX} cached ${issues.length} search results`)
			}
			break
		}
		case "get_workflow_states": {
			const doneId = extractDoneStateId(response)
			const startedId = extractStartedStateId(response)
			setWorkflowStates(directory, {
				done_state_id: doneId,
				started_state_id: startedId,
			})
			log(`${LOG_PREFIX} cached workflow states`, { doneId, startedId })
			break
		}
		case "create_issue": {
			const issue = extractIssue(response)
			if (issue) {
				upsertIssueInCache(directory, issue)
				const cache = readShadowCache(directory) ?? {
					...EMPTY_SHADOW_CACHE,
					last_updated: new Date().toISOString(),
				}
				if (!cache.open_issue_ids.includes(issue.identifier)) {
					cache.open_issue_ids.push(issue.identifier)
					writeShadowCache(directory, cache)
				}
				log(`${LOG_PREFIX} cached created issue`, { identifier: issue.identifier })
			}
			break
		}
	}
}

function extractIssuesFromSearch(value: unknown): LinearIssue[] {
	if (!value || typeof value !== "object") return []
	const issues: LinearIssue[] = []

	if (Array.isArray(value)) {
		for (const item of value) {
			const issue = extractIssue(item)
			if (issue) issues.push(issue)
		}
		return issues
	}

	const record = value as Record<string, unknown>
	for (const v of Object.values(record)) {
		if (Array.isArray(v)) {
			for (const item of v) {
				const issue = extractIssue(item)
				if (issue) issues.push(issue)
			}
		}
	}
	return issues
}

function extractStartedStateId(value: unknown): string | null {
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractStartedStateId(item)
			if (found) return found
		}
		return null
	}
	if (!value || typeof value !== "object") return null
	const record = value as Record<string, unknown>
	const type = typeof record.type === "string" ? record.type : null
	if (type === "started" && typeof record.id === "string") return record.id
	for (const nested of Object.values(record)) {
		const found = extractStartedStateId(nested)
		if (found) return found
	}
	return null
}

function safeJsonParse(text: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(text)
		return typeof parsed === "object" && parsed !== null ? parsed : {}
	} catch {
		return {}
	}
}
