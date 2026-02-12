import type { LinearIssue } from "../../features/linear-state/types"
import { extractIssue, extractDoneStateId } from "../../features/linear-state/linear-response-parser"
import {
	upsertIssueInCache,
	updateOpenIssueIds,
	setWorkflowStates,
	readShadowCache,
	writeShadowCache,
} from "../../features/linear-state/shadow-cache"
import { createEmptyShadowCache } from "../../features/linear-state/shadow-cache-types"
import { log } from "../../shared/logger"

const LOG_PREFIX = "[linear-mcp-interceptor]"

export function handleLinearResponse(
	directory: string,
	toolName: string,
	args: Record<string, unknown>,
	response: Record<string, unknown>,
): void {
	void args
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
				const cache = readShadowCache(directory) ?? createEmptyShadowCache()
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

export function extractIssuesFromSearch(value: unknown): LinearIssue[] {
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

export function extractStartedStateId(value: unknown): string | null {
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

export function safeJsonParse(text: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(text)
		return typeof parsed === "object" && parsed !== null ? parsed : {}
	} catch {
		return {}
	}
}
