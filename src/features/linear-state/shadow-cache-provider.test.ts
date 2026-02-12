import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeShadowCache } from "./shadow-cache";
import { createLinearShadowCacheProvider } from "./shadow-cache-provider";
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

describe("createLinearShadowCacheProvider", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "shadow-cache-provider-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("getProgress returns safe progress when no cache exists", async () => {
		//#given
		const provider = createLinearShadowCacheProvider(testDir);

		//#when
		const progress = await provider.getProgress("OMO-200");

		//#then
		expect(progress).toEqual({ total: 0, completed: 0, isComplete: true });
	});

	test("getProgress counts sub-issues correctly", async () => {
		//#given
		const issue = createIssue("OMO-201", "started", {
			subIssues: [
				createIssue("OMO-201-A", "completed"),
				createIssue("OMO-201-B", "unstarted"),
				createIssue("OMO-201-C", "completed"),
			],
		});
		const cache: LinearShadowCache = {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: new Date().toISOString(),
		};
		writeShadowCache(testDir, cache);
		const provider = createLinearShadowCacheProvider(testDir);

		//#when
		const progress = await provider.getProgress(issue.identifier);

		//#then
		expect(progress.total).toBe(3);
		expect(progress.completed).toBe(2);
		expect(progress.isComplete).toBe(false);
	});

	test("markTaskComplete marks sub-issue as completed in cache", async () => {
		//#given
		const subIssue = createIssue("OMO-202-A", "started");
		const issue = createIssue("OMO-202", "started", { subIssues: [subIssue] });
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: new Date().toISOString(),
		});
		const provider = createLinearShadowCacheProvider(testDir);

		//#when
		await provider.markTaskComplete(issue.identifier, subIssue.identifier);
		const updatedProgress = await provider.getProgress(issue.identifier);

		//#then
		expect(updatedProgress.total).toBe(1);
		expect(updatedProgress.completed).toBe(1);
		expect(updatedProgress.isComplete).toBe(true);
	});

	test("isComplete returns true when all sub-issues are done", async () => {
		//#given
		const issue = createIssue("OMO-203", "started", {
			subIssues: [createIssue("OMO-203-A", "completed")],
		});
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: new Date().toISOString(),
		});
		const provider = createLinearShadowCacheProvider(testDir);

		//#when
		const complete = await provider.isComplete(issue.identifier);

		//#then
		expect(complete).toBe(true);
	});

	test("isComplete returns false when some sub-issues are incomplete", async () => {
		//#given
		const issue = createIssue("OMO-204", "started", {
			subIssues: [
				createIssue("OMO-204-A", "completed"),
				createIssue("OMO-204-B", "started"),
			],
		});
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: new Date().toISOString(),
		});
		const provider = createLinearShadowCacheProvider(testDir);

		//#when
		const complete = await provider.isComplete(issue.identifier);

		//#then
		expect(complete).toBe(false);
	});

	test("findNextOpenIssueId delegates to shadow cache behavior", () => {
		//#given
		const activeIssue = createIssue("OMO-205", "started");
		const completedIssue = createIssue("OMO-206", "completed");
		const nextIssue = createIssue("OMO-207", "unstarted");
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			active_issue_id: activeIssue.identifier,
			issues: {
				[activeIssue.identifier]: activeIssue,
				[completedIssue.identifier]: completedIssue,
				[nextIssue.identifier]: nextIssue,
			},
			open_issue_ids: [
				activeIssue.identifier,
				completedIssue.identifier,
				nextIssue.identifier,
			],
			last_updated: new Date().toISOString(),
		});
		const provider = createLinearShadowCacheProvider(testDir);

		//#when
		const nextId = provider.findNextOpenIssueId();

		//#then
		expect(nextId).toBe(nextIssue.identifier);
	});
});
