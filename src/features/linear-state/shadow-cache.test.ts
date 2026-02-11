import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findNextOpenIssueId,
	getCachePath,
	readShadowCache,
	setActiveIssue,
	setWorkflowStates,
	updateOpenIssueIds,
	upsertIssueInCache,
	writeShadowCache,
} from "./shadow-cache";
import {
	EMPTY_SHADOW_CACHE,
	type LinearShadowCache,
} from "./shadow-cache-types";
import type { LinearIssue, LinearStateType } from "./types";

function createIssue(
	identifier: string,
	stateType: LinearStateType,
	overrides: Partial<LinearIssue> = {},
): LinearIssue {
	return {
		id: `${identifier}-id`,
		identifier,
		title: `Issue ${identifier}`,
		description: "",
		state: {
			id: `${stateType}-state`,
			name: stateType,
			type: stateType,
		},
		labels: [],
		...overrides,
	};
}

describe("shadow-cache", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "shadow-cache-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("readShadowCache returns null when cache file does not exist", () => {
		//#given

		//#when
		const cache = readShadowCache(testDir);

		//#then
		expect(cache).toBeNull();
	});

	test("readShadowCache parses JSON when cache file exists", () => {
		//#given
		const issue = createIssue("OMO-101", "unstarted");
		const initialCache: LinearShadowCache = {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: "2026-01-01T00:00:00.000Z",
		};
		writeShadowCache(testDir, initialCache);

		//#when
		const cache = readShadowCache(testDir);

		//#then
		expect(cache).not.toBeNull();
		expect(cache?.issues[issue.identifier]?.identifier).toBe("OMO-101");
		expect(cache?.open_issue_ids).toEqual(["OMO-101"]);
	});

	test("writeShadowCache creates directories and writes JSON", () => {
		//#given
		const issue = createIssue("OMO-102", "started");
		const cache: LinearShadowCache = {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: "2026-01-01T00:00:00.000Z",
		};

		//#when
		const wrote = writeShadowCache(testDir, cache);
		const filePath = getCachePath(testDir);

		//#then
		expect(wrote).toBe(true);
		expect(existsSync(filePath)).toBe(true);
		const parsed = JSON.parse(
			readFileSync(filePath, "utf-8"),
		) as LinearShadowCache;
		expect(parsed.issues[issue.identifier]?.title).toBe("Issue OMO-102");
		expect(parsed.last_updated).not.toBe("2026-01-01T00:00:00.000Z");
	});

	test("upsertIssueInCache creates cache if needed and adds issue", () => {
		//#given
		const issue = createIssue("OMO-103", "unstarted");

		//#when
		upsertIssueInCache(testDir, issue);
		const cache = readShadowCache(testDir);

		//#then
		expect(cache).not.toBeNull();
		expect(cache?.issues["OMO-103"]?.id).toBe("OMO-103-id");
	});

	test("setActiveIssue stores active_issue_id", () => {
		//#given
		const issue = createIssue("OMO-104", "started");
		upsertIssueInCache(testDir, issue);

		//#when
		setActiveIssue(testDir, issue.identifier);
		const cache = readShadowCache(testDir);

		//#then
		expect(cache?.active_issue_id).toBe("OMO-104");
	});

	test("updateOpenIssueIds filters completed issues and stores identifiers", () => {
		//#given
		const openIssue = createIssue("OMO-105", "started");
		const doneIssue = createIssue("OMO-106", "completed");

		//#when
		updateOpenIssueIds(testDir, [openIssue, doneIssue]);
		const cache = readShadowCache(testDir);

		//#then
		expect(cache?.open_issue_ids).toEqual(["OMO-105"]);
		expect(cache?.issues["OMO-106"]?.state.type).toBe("completed");
	});

	test("setWorkflowStates stores done and started state IDs", () => {
		//#given
		const states = {
			done_state_id: "done-id",
			started_state_id: "started-id",
		};

		//#when
		setWorkflowStates(testDir, states);
		const cache = readShadowCache(testDir);

		//#then
		expect(cache?.workflow_states).toEqual(states);
	});

	test("findNextOpenIssueId skips active and completed issues", () => {
		//#given
		const activeIssue = createIssue("OMO-107", "started");
		const doneIssue = createIssue("OMO-108", "completed");
		const nextIssue = createIssue("OMO-109", "unstarted");
		updateOpenIssueIds(testDir, [activeIssue, doneIssue, nextIssue]);
		setActiveIssue(testDir, activeIssue.identifier);

		//#when
		const nextId = findNextOpenIssueId(testDir);

		//#then
		expect(nextId).toBe("OMO-109");
	});

	test("findNextOpenIssueId skips cache-miss issues instead of treating them as open", () => {
		//#given
		const cachedOpen = createIssue("OMO-120", "unstarted");
		upsertIssueInCache(testDir, cachedOpen);
		const cache = readShadowCache(testDir)!;
		cache.open_issue_ids = ["OMO-MISSING", "OMO-120"];
		cache.active_issue_id = null;
		writeShadowCache(testDir, cache);

		//#when
		const nextId = findNextOpenIssueId(testDir);

		//#then
		expect(nextId).toBe("OMO-120");
	});

	test("findNextOpenIssueId returns null when all issues are cache-misses", () => {
		//#given
		const cache = readShadowCache(testDir) ?? {
			...EMPTY_SHADOW_CACHE,
			last_updated: new Date().toISOString(),
		};
		cache.open_issue_ids = ["OMO-GHOST-1", "OMO-GHOST-2"];
		writeShadowCache(testDir, cache);

		//#when
		const nextId = findNextOpenIssueId(testDir);

		//#then
		expect(nextId).toBeNull();
	});

	test("findNextOpenIssueId returns null when there are no valid next issues", () => {
		//#given
		const activeIssue = createIssue("OMO-110", "started");
		const doneIssue = createIssue("OMO-111", "completed");
		updateOpenIssueIds(testDir, [activeIssue, doneIssue]);
		setActiveIssue(testDir, activeIssue.identifier);

		//#when
		const nextId = findNextOpenIssueId(testDir);

		//#then
		expect(nextId).toBeNull();
	});
});
