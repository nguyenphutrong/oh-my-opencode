import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"
import { resolveLinearPlanRef } from "./ralph-loop-plan-ref"

const TEST_DIR = join(import.meta.dir, "__test_planref_tmp__")
const SISYPHUS_DIR = join(TEST_DIR, ".sisyphus")

function writeBoulder(state: Record<string, unknown>) {
	mkdirSync(SISYPHUS_DIR, { recursive: true })
	writeFileSync(join(SISYPHUS_DIR, "boulder.json"), JSON.stringify(state))
}

describe("resolveLinearPlanRef", () => {
	beforeEach(() => {
		mkdirSync(TEST_DIR, { recursive: true })
	})

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true })
		}
	})

	//#given no boulder state exists
	//#when resolveLinearPlanRef is called
	//#then returns undefined
	test("returns undefined when no boulder state", () => {
		expect(resolveLinearPlanRef(TEST_DIR)).toBeUndefined()
	})

	//#given boulder state with tracking_provider=linear and linear_issue_id
	//#when resolveLinearPlanRef is called
	//#then returns the linear_issue_id
	test("returns linear_issue_id when tracking_provider is linear", () => {
		writeBoulder({
			active_plan: "some-plan",
			tracking_provider: "linear",
			linear_issue_id: "ENG-123",
			started_at: new Date().toISOString(),
			session_ids: ["ses-1"],
			plan_name: "Test Issue",
		})

		expect(resolveLinearPlanRef(TEST_DIR)).toBe("ENG-123")
	})

	//#given boulder state with tracking_provider=linear but no linear_issue_id
	//#when resolveLinearPlanRef is called
	//#then falls back to active_plan
	test("falls back to active_plan when linear but no issue id", () => {
		writeBoulder({
			active_plan: "/path/to/plan.md",
			tracking_provider: "linear",
			started_at: new Date().toISOString(),
			session_ids: ["ses-1"],
			plan_name: "Test Plan",
		})

		expect(resolveLinearPlanRef(TEST_DIR)).toBe("/path/to/plan.md")
	})

	//#given boulder state with tracking_provider=markdown
	//#when resolveLinearPlanRef is called
	//#then returns active_plan
	test("returns active_plan for markdown tracking provider", () => {
		writeBoulder({
			active_plan: "/path/to/plan.md",
			tracking_provider: "markdown",
			started_at: new Date().toISOString(),
			session_ids: ["ses-1"],
			plan_name: "Test Plan",
		})

		expect(resolveLinearPlanRef(TEST_DIR)).toBe("/path/to/plan.md")
	})

	//#given boulder state without tracking_provider (default)
	//#when resolveLinearPlanRef is called
	//#then returns active_plan
	test("returns active_plan when no tracking_provider set", () => {
		writeBoulder({
			active_plan: "/path/to/plan.md",
			started_at: new Date().toISOString(),
			session_ids: ["ses-1"],
			plan_name: "Test Plan",
		})

		expect(resolveLinearPlanRef(TEST_DIR)).toBe("/path/to/plan.md")
	})
})
