import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeShadowCache } from "../../features/linear-state/shadow-cache";
import { EMPTY_SHADOW_CACHE } from "../../features/linear-state/shadow-cache-types";
import type {
	LinearIssue,
	LinearStateType,
} from "../../features/linear-state/types";
import {
	discoverLinearIssues,
	discoverMarkdownPlans,
	findPlanByName,
} from "./plan-discovery";

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

describe("plan-discovery", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "plan-discovery-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("discoverMarkdownPlans finds plan files and calculates progress", () => {
		//#given
		const plansDir = join(testDir, ".sisyphus", "plans");
		const planA = join(plansDir, "feature-a.md");
		const planB = join(plansDir, "feature-b.md");
		mkdirSync(plansDir, { recursive: true });
		writeFileSync(planA, "# A\n- [x] one\n- [ ] two\n", "utf-8");
		writeFileSync(planB, "# B\n- [x] one\n", "utf-8");

		//#when
		const plans = discoverMarkdownPlans(testDir);

		//#then
		expect(plans.length).toBe(2);
		const featureA = plans.find((p) => p.name === "feature-a");
		expect(featureA?.completed).toBe(1);
		expect(featureA?.total).toBe(2);
		expect(featureA?.provider).toBe("markdown");
	});

	test("discoverLinearIssues reads shadow cache and filters completed issues", () => {
		//#given
		const openIssue = createIssue("OMO-501", "started", {
			title: "Open Issue",
			subIssues: [
				createIssue("OMO-501-A", "completed"),
				createIssue("OMO-501-B", "started"),
			],
		});
		const doneIssue = createIssue("OMO-502", "completed", {
			title: "Done Issue",
		});
		writeShadowCache(testDir, {
			...EMPTY_SHADOW_CACHE,
			issues: {
				[openIssue.identifier]: openIssue,
				[doneIssue.identifier]: doneIssue,
			},
			open_issue_ids: [openIssue.identifier, doneIssue.identifier],
			last_updated: new Date().toISOString(),
		});

		//#when
		const candidates = discoverLinearIssues(testDir);

		//#then
		expect(candidates.length).toBe(1);
		expect(candidates[0]?.id).toBe("OMO-501");
		expect(candidates[0]?.name).toBe("Open Issue");
		expect(candidates[0]?.completed).toBe(1);
		expect(candidates[0]?.total).toBe(2);
		expect(candidates[0]?.provider).toBe("linear");
	});

	test("findPlanByName supports exact match, partial match, and no match", () => {
		//#given
		const plans = [
			"/tmp/.sisyphus/plans/alpha-plan.md",
			"/tmp/.sisyphus/plans/2026-02-beta-feature.md",
		];

		//#when
		const exact = findPlanByName(plans, "alpha-plan");
		const partial = findPlanByName(plans, "beta-feature");
		const missing = findPlanByName(plans, "gamma");

		//#then
		expect(exact).toBe("/tmp/.sisyphus/plans/alpha-plan.md");
		expect(partial).toBe("/tmp/.sisyphus/plans/2026-02-beta-feature.md");
		expect(missing).toBeNull();
	});
});
