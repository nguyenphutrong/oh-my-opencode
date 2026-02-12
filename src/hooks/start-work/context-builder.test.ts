import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BoulderState } from "../../features/boulder-state";
import {
	readBoulderState,
	writeBoulderState,
} from "../../features/boulder-state";
import {
	readShadowCache,
	writeShadowCache,
} from "../../features/linear-state/shadow-cache";
import { EMPTY_SHADOW_CACHE } from "../../features/linear-state/shadow-cache-types";
import type {
	LinearIssue,
	LinearStateType,
} from "../../features/linear-state/types";
import { buildStartWorkContext } from "./context-builder";

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

describe("buildStartWorkContext", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "context-builder-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("returns No Plans Found when no plans and no Linear issues", () => {
		//#given

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-1",
			timestamp: "2026-02-10T10:00:00.000Z",
			explicitPlanName: null,
		});

		//#then
		expect(context).toContain("No Plans Found");
	});

	test("auto-selects a single markdown plan", () => {
		//#given
		mkdirSync(join(testDir, ".sisyphus", "plans"), { recursive: true });
		const planPath = join(testDir, ".sisyphus", "plans", "single-plan.md");
		writeFileSync(planPath, "# Plan\n- [ ] task\n", "utf-8");

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-2",
			timestamp: "2026-02-10T10:10:00.000Z",
			explicitPlanName: null,
		});
		const state = readBoulderState(testDir);

		//#then
		expect(context).toContain("Auto-Selected Plan");
		expect(context).toContain("single-plan");
		expect(state?.active_plan).toBe(planPath);
		expect(state?.tracking_provider).toBeUndefined();
	});

	test("auto-selects a single Linear issue and creates linear boulder state", () => {
		//#given
		const issue = createIssue("OMO-601", "started", {
			title: "Linear Candidate",
			subIssues: [createIssue("OMO-601-A", "started")],
		});
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: new Date().toISOString(),
		});

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-3",
			timestamp: "2026-02-10T10:20:00.000Z",
			explicitPlanName: null,
		});
		const state = readBoulderState(testDir);
		const cache = readShadowCache(testDir);

		//#then
		expect(context).toContain("Auto-Selected Plan");
		expect(context).toContain("Provider**: linear");
		expect(state?.tracking_provider).toBe("linear");
		expect(state?.linear_issue_id).toBe("OMO-601");
		expect(cache?.active_issue_id).toBe("OMO-601");
	});

	test("shows multiple candidates when markdown and linear options both exist", () => {
		//#given
		mkdirSync(join(testDir, ".sisyphus", "plans"), { recursive: true });
		const markdownPlanPath = join(
			testDir,
			".sisyphus",
			"plans",
			"markdown-plan.md",
		);
		writeFileSync(markdownPlanPath, "# Markdown\n- [ ] item\n", "utf-8");
		const issue = createIssue("OMO-602", "started", { title: "Linear Plan" });
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: { [issue.identifier]: issue },
			open_issue_ids: [issue.identifier],
			last_updated: new Date().toISOString(),
		});

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-4",
			timestamp: "2026-02-10T10:30:00.000Z",
			explicitPlanName: null,
		});

		//#then
		expect(context).toContain("Multiple Plans Found");
		expect(context).toContain("[Linear]");
		expect(context).toContain("[Markdown]");
	});

	test("resumes existing linear boulder state", () => {
		//#given
		const linearState: BoulderState = {
			active_plan: "OMO-603",
			started_at: "2026-02-10T09:00:00.000Z",
			session_ids: ["old-session"],
			plan_name: "Linear Resume",
			tracking_provider: "linear",
			linear_issue_id: "OMO-603",
		};
		writeBoulderState(testDir, linearState);

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-5",
			timestamp: "2026-02-10T10:40:00.000Z",
			explicitPlanName: null,
		});
		const updatedState = readBoulderState(testDir);

		//#then
		expect(context).toContain("Active Linear Work Session Found");
		expect(context).toContain("RESUMING");
		expect(updatedState?.session_ids).toContain("session-5");
	});

	test("resumes existing markdown boulder state", () => {
		//#given
		mkdirSync(join(testDir, ".sisyphus", "plans"), { recursive: true });
		const markdownPlanPath = join(
			testDir,
			".sisyphus",
			"plans",
			"resume-plan.md",
		);
		writeFileSync(markdownPlanPath, "# Resume\n- [ ] task\n", "utf-8");
		const markdownState: BoulderState = {
			active_plan: markdownPlanPath,
			started_at: "2026-02-10T09:10:00.000Z",
			session_ids: ["old-session"],
			plan_name: "resume-plan",
		};
		writeBoulderState(testDir, markdownState);

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-6",
			timestamp: "2026-02-10T10:50:00.000Z",
			explicitPlanName: null,
		});
		const updatedState = readBoulderState(testDir);

		//#then
		expect(context).toContain("Active Work Session Found");
		expect(context).toContain("RESUMING");
		expect(context).toContain("resume-plan");
		expect(updatedState?.session_ids).toContain("session-6");
	});

	test("returns Linear first-run instructions when no plans/issues but Linear config exists", () => {
		//#given
		mkdirSync(join(testDir, ".opencode"), { recursive: true });
		writeFileSync(
			join(testDir, ".opencode", "oh-my-opencode.json"),
			JSON.stringify({ ralph_loop: { tracking_provider: "linear", linear: { team_id: "team-abc" } } }),
			"utf-8",
		);

		//#when
		const context = buildStartWorkContext({
			directory: testDir,
			sessionId: "session-linear",
			timestamp: "2026-02-10T11:00:00.000Z",
			explicitPlanName: null,
		});

		//#then
		expect(context).toContain("Linear Mode");
		expect(context).toContain("First Run Setup");
		expect(context).toContain("search_issues");
		expect(context).toContain("get_workflow_states");
	});
});
