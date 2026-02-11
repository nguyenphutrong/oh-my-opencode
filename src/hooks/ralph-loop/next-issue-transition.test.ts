/// <reference types="bun-types" />

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RalphLoopState } from "./types";
import { writeBoulderState, readBoulderState } from "../../features/boulder-state";
import { writeShadowCache, setActiveIssue, readShadowCache } from "../../features/linear-state/shadow-cache";
import { EMPTY_SHADOW_CACHE, createEmptyShadowCache } from "../../features/linear-state/shadow-cache-types";
import {
	buildRefreshSearchPrompt,
	buildNextIssueContinuationPrompt,
	transitionToNextIssue,
} from "./next-issue-transition";

function createRalphLoopState(overrides: Partial<RalphLoopState> = {}): RalphLoopState {
	return {
		active: true,
		iteration: 1,
		max_iterations: 5,
		completion_promise: "task.completed",
		started_at: new Date().toISOString(),
		prompt: "Test prompt",
		session_id: "test-session",
		ultrawork: false,
		plan_ref: "test-plan",
		...overrides,
	};
}

describe("buildRefreshSearchPrompt", () => {
	test("should include search_issues instruction", () => {
		//#given
		const state = createRalphLoopState({ iteration: 2, max_iterations: 10 });

		//#when
		const prompt = buildRefreshSearchPrompt(state);

		//#then
		expect(prompt).toContain("search_issues");
	});

	test("should include completion promise", () => {
		//#given
		const state = createRalphLoopState({ completion_promise: "all.done" });

		//#when
		const prompt = buildRefreshSearchPrompt(state);

		//#then
		expect(prompt).toContain("<promise>all.done</promise>");
	});

	test("should prefix with ultrawork when state.ultrawork is true", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: true });

		//#when
		const prompt = buildRefreshSearchPrompt(state);

		//#then
		expect(prompt).toStartWith("ultrawork [SYSTEM DIRECTIVE");
	});

	test("should not prefix with ultrawork when state.ultrawork is false", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: false });

		//#when
		const prompt = buildRefreshSearchPrompt(state);

		//#then
		expect(prompt).toStartWith("[SYSTEM DIRECTIVE");
		expect(prompt).not.toContain("ultrawork");
	});

	test("should include iteration count in header", () => {
		//#given
		const state = createRalphLoopState({ iteration: 3, max_iterations: 7 });

		//#when
		const prompt = buildRefreshSearchPrompt(state);

		//#then
		expect(prompt).toContain("RALPH LOOP 3/7");
	});
});

describe("buildNextIssueContinuationPrompt", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "next-issue-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("without directory should include fallback instruction to get_workflow_states", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: false });
		const nextIssueId = "ENG-456";

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state);

		//#then
		expect(prompt).toContain("get_workflow_states");
		expect(prompt).toContain("update_issue");
		expect(prompt).toContain("In Progress");
	});

	test("with directory and shadow cache containing started_state_id should include specific stateId", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: false });
		const nextIssueId = "ENG-789";
		const startedStateId = "started-state-123";
		const cache = createEmptyShadowCache();
		cache.workflow_states.started_state_id = startedStateId;
		writeShadowCache(testDir, cache);

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state, testDir);

		//#then
		expect(prompt).toContain(startedStateId);
		expect(prompt).not.toContain("get_workflow_states");
	});

	test("with directory but no shadow cache should include fallback instruction", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: false });
		const nextIssueId = "ENG-999";

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state, testDir);

		//#then
		expect(prompt).toContain("get_workflow_states");
	});

	test("should prefix with ultrawork when state.ultrawork is true", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: true });
		const nextIssueId = "ENG-123";

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state);

		//#then
		expect(prompt).toStartWith("ultrawork [SYSTEM DIRECTIVE");
	});

	test("should not prefix with ultrawork when state.ultrawork is false", () => {
		//#given
		const state = createRalphLoopState({ ultrawork: false });
		const nextIssueId = "ENG-123";

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state);

		//#then
		expect(prompt).toStartWith("[SYSTEM DIRECTIVE");
	});

	test("should include the next issue ID", () => {
		//#given
		const state = createRalphLoopState({});
		const nextIssueId = "ENG-SPECIAL-001";

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state);

		//#then
		expect(prompt).toContain(nextIssueId);
		expect(prompt).toContain("ENG-SPECIAL-001");
	});

	test("should include completion promise", () => {
		//#given
		const state = createRalphLoopState({ completion_promise: "mission.complete" });
		const nextIssueId = "ENG-001";

		//#when
		const prompt = buildNextIssueContinuationPrompt(nextIssueId, state);

		//#then
		expect(prompt).toContain("<promise>mission.complete</promise>");
	});
});

describe("transitionToNextIssue", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "transition-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("should update boulder state with new issue ID", () => {
		//#given
		const boulder = {
			active_plan: "/test/plan.md",
			started_at: new Date().toISOString(),
			session_ids: ["session-1"],
			plan_name: "test-plan",
			linear_issue_id: "ENG-OLD-001",
		};
		writeBoulderState(testDir, boulder);
		const nextIssueId = "ENG-NEW-001";

		//#when
		transitionToNextIssue(testDir, nextIssueId);

		//#then
		const updated = readBoulderState(testDir);
		expect(updated).not.toBeNull();
		expect(updated!.linear_issue_id).toBe(nextIssueId);
		expect(updated!.active_plan).toBe(nextIssueId);
		expect(updated!.plan_name).toBe(nextIssueId);
	});

	test("should set active issue in shadow cache", () => {
		//#given
		const boulder = {
			active_plan: "/test/plan.md",
			started_at: new Date().toISOString(),
			session_ids: ["session-1"],
			plan_name: "test-plan",
			linear_issue_id: "ENG-OLD-002",
		};
		writeBoulderState(testDir, boulder);
		const nextIssueId = "ENG-NEW-002";

		//#when
		transitionToNextIssue(testDir, nextIssueId);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache).not.toBeNull();
		expect(cache!.active_issue_id).toBe(nextIssueId);
	});

	test("should update both boulder state and shadow cache atomically", () => {
		//#given
		const boulder = {
			active_plan: "/test/plan.md",
			started_at: new Date().toISOString(),
			session_ids: ["session-1"],
			plan_name: "test-plan",
			linear_issue_id: "ENG-ATOMIC-001",
		};
		writeBoulderState(testDir, boulder);
		const nextIssueId = "ENG-ATOMIC-002";

		//#when
		transitionToNextIssue(testDir, nextIssueId);

		//#then
		const updatedBoulder = readBoulderState(testDir);
		const updatedCache = readShadowCache(testDir);

		expect(updatedBoulder!.linear_issue_id).toBe(nextIssueId);
		expect(updatedBoulder!.active_plan).toBe(nextIssueId);
		expect(updatedBoulder!.plan_name).toBe(nextIssueId);
		expect(updatedCache!.active_issue_id).toBe(nextIssueId);
	});

	test("should do nothing when boulder state does not exist", () => {
		//#given
		const nextIssueId = "ENG-NO-BOULDER";

		//#when
		transitionToNextIssue(testDir, nextIssueId);

		//#then
		const cache = readShadowCache(testDir);
		expect(cache).toBeNull();
	});

	test("should set active issue even when boulder state exists but has no issue ID", () => {
		//#given
		const boulder = {
			active_plan: "/test/plan.md",
			started_at: new Date().toISOString(),
			session_ids: ["session-1"],
			plan_name: "test-plan",
		};
		writeBoulderState(testDir, boulder);
		const nextIssueId = "ENG-NEW-WITHOUT-OLD";

		//#when
		transitionToNextIssue(testDir, nextIssueId);

		//#then
		const updated = readBoulderState(testDir);
		const updatedCache = readShadowCache(testDir);
		expect(updated!.linear_issue_id).toBe(nextIssueId);
		expect(updatedCache!.active_issue_id).toBe(nextIssueId);
	});
});
