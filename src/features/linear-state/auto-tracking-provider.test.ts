import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BoulderState } from "../boulder-state";
import { writeBoulderState } from "../boulder-state";
import { createAutoTrackingProvider } from "./auto-tracking-provider";
import { readShadowCache, writeShadowCache } from "./shadow-cache";
import { EMPTY_SHADOW_CACHE } from "./shadow-cache-types";
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

describe("createAutoTrackingProvider", () => {
	let testDir: string;
	let markdownPlanPath: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "auto-tracking-provider-test-"));
		markdownPlanPath = join(testDir, "plan.md");
		writeFileSync(markdownPlanPath, "# Plan\n- [ ] TASK-1\n", "utf-8");
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("uses markdown provider when no boulder state exists", async () => {
		//#given
		const provider = createAutoTrackingProvider(testDir);

		//#when
		await provider.markTaskComplete(markdownPlanPath, "TASK-1");
		const content = readFileSync(markdownPlanPath, "utf-8");

		//#then
		expect(provider.type).toBe("markdown");
		expect(content).toContain("- [x] TASK-1");
	});

	test("uses markdown provider when boulder tracking_provider is undefined", async () => {
		//#given
		const state: BoulderState = {
			active_plan: markdownPlanPath,
			started_at: "2026-01-01T00:00:00.000Z",
			session_ids: ["session-1"],
			plan_name: "plan",
		};
		writeBoulderState(testDir, state);
		const provider = createAutoTrackingProvider(testDir);

		//#when
		await provider.markTaskComplete(markdownPlanPath, "TASK-1");
		const content = readFileSync(markdownPlanPath, "utf-8");

		//#then
		expect(provider.type).toBe("markdown");
		expect(content).toContain("- [x] TASK-1");
	});

	test("uses linear provider when boulder.tracking_provider is linear", async () => {
		//#given
		const linearIssue = createIssue("OMO-301", "started", {
			subIssues: [createIssue("OMO-301-A", "started")],
		});
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: { [linearIssue.identifier]: linearIssue },
			open_issue_ids: [linearIssue.identifier],
			last_updated: new Date().toISOString(),
		});
		const state: BoulderState = {
			active_plan: linearIssue.identifier,
			started_at: "2026-01-01T00:00:00.000Z",
			session_ids: ["session-1"],
			plan_name: linearIssue.title,
			tracking_provider: "linear",
			linear_issue_id: linearIssue.identifier,
		};
		writeBoulderState(testDir, state);
		const provider = createAutoTrackingProvider(testDir);

		//#when
		await provider.markTaskComplete(linearIssue.identifier, "OMO-301-A");
		const cache = readShadowCache(testDir);
		const content = readFileSync(markdownPlanPath, "utf-8");

		//#then
		expect(provider.type).toBe("linear");
		expect(
			cache?.issues[linearIssue.identifier]?.subIssues?.[0]?.state.type,
		).toBe("completed");
		expect(content).toContain("- [ ] TASK-1");
	});

	test("type getter reflects current provider state dynamically", () => {
		//#given
		const provider = createAutoTrackingProvider(testDir);

		//#when
		const beforeType = provider.type;
		writeBoulderState(testDir, {
			active_plan: "OMO-302",
			started_at: "2026-01-01T00:00:00.000Z",
			session_ids: ["session-2"],
			plan_name: "Issue OMO-302",
			tracking_provider: "linear",
			linear_issue_id: "OMO-302",
		});
		const afterType = provider.type;

		//#then
		expect(beforeType).toBe("markdown");
		expect(afterType).toBe("linear");
	});
});
