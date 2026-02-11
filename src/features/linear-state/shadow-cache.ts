import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import type { LinearShadowCache } from "./shadow-cache-types"
import type { LinearIssue } from "./types"
import { EMPTY_SHADOW_CACHE } from "./shadow-cache-types"
import { isIssueCompleted } from "./linear-response-parser"

const CACHE_DIR = ".sisyphus"
const CACHE_FILE = "linear-cache.json"

export function getCachePath(directory: string): string {
	return join(directory, CACHE_DIR, CACHE_FILE)
}

export function readShadowCache(directory: string): LinearShadowCache | null {
	const filePath = getCachePath(directory)
	if (!existsSync(filePath)) return null
	try {
		const content = readFileSync(filePath, "utf-8")
		return JSON.parse(content) as LinearShadowCache
	} catch {
		return null
	}
}

export function writeShadowCache(
	directory: string,
	cache: LinearShadowCache,
): boolean {
	const filePath = getCachePath(directory)
	try {
		const dir = dirname(filePath)
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
		cache.last_updated = new Date().toISOString()
		writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8")
		return true
	} catch {
		return false
	}
}

export function upsertIssueInCache(
	directory: string,
	issue: LinearIssue,
): void {
	const cache = readShadowCache(directory) ?? {
		...EMPTY_SHADOW_CACHE,
		last_updated: new Date().toISOString(),
	}
	cache.issues[issue.identifier] = issue
	writeShadowCache(directory, cache)
}

export function setActiveIssue(
	directory: string,
	issueIdentifier: string,
): void {
	const cache = readShadowCache(directory) ?? {
		...EMPTY_SHADOW_CACHE,
		last_updated: new Date().toISOString(),
	}
	cache.active_issue_id = issueIdentifier
	writeShadowCache(directory, cache)
}

export function updateOpenIssueIds(
	directory: string,
	issues: LinearIssue[],
): void {
	const cache = readShadowCache(directory) ?? {
		...EMPTY_SHADOW_CACHE,
		last_updated: new Date().toISOString(),
	}
	cache.open_issue_ids = issues
		.filter((i) => !isIssueCompleted(i))
		.map((i) => i.identifier)
	for (const issue of issues) {
		cache.issues[issue.identifier] = issue
	}
	writeShadowCache(directory, cache)
}

export function setWorkflowStates(
	directory: string,
	states: { done_state_id: string | null; started_state_id: string | null },
): void {
	const cache = readShadowCache(directory) ?? {
		...EMPTY_SHADOW_CACHE,
		last_updated: new Date().toISOString(),
	}
	cache.workflow_states = states
	writeShadowCache(directory, cache)
}

export function findNextOpenIssueId(
	directory: string,
): string | null {
	const cache = readShadowCache(directory)
	if (!cache) return null

	const activeId = cache.active_issue_id
	for (const id of cache.open_issue_ids) {
		if (id === activeId) continue
		const issue = cache.issues[id]
		if (!issue || !isIssueCompleted(issue)) return id
	}
	return null
}
