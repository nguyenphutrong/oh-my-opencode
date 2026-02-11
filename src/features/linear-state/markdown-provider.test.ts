import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMarkdownStateProvider } from "./markdown-provider"

describe("createMarkdownStateProvider", () => {
	let testDir: string
	let provider: ReturnType<typeof createMarkdownStateProvider>

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "markdown-provider-test-"))
		provider = createMarkdownStateProvider()
	})

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true })
	})

	function writePlan(filename: string, content: string): string {
		const plansDir = join(testDir, ".sisyphus", "plans")
		mkdirSync(plansDir, { recursive: true })
		const planPath = join(plansDir, filename)
		writeFileSync(planPath, content, "utf-8")
		return planPath
	}

	test("getProgress returns correct counts from markdown checkboxes", async () => {
		//#given
		const planPath = writePlan("plan.md", [
			"# Plan",
			"- [x] Task 1",
			"- [ ] Task 2",
			"- [x] Task 3",
		].join("\n"))

		//#when
		const progress = await provider.getProgress(planPath)

		//#then
		expect(progress.total).toBe(3)
		expect(progress.completed).toBe(2)
		expect(progress.isComplete).toBe(false)
	})

	test("getProgress returns isComplete true when all tasks done", async () => {
		//#given
		const planPath = writePlan("done.md", [
			"# Plan",
			"- [x] Task 1",
			"- [x] Task 2",
		].join("\n"))

		//#when
		const progress = await provider.getProgress(planPath)

		//#then
		expect(progress.total).toBe(2)
		expect(progress.completed).toBe(2)
		expect(progress.isComplete).toBe(true)
	})

	test("getProgress returns zero progress for non-existent file", async () => {
		//#given
		const fakePath = join(testDir, "nonexistent.md")

		//#when
		const progress = await provider.getProgress(fakePath)

		//#then
		expect(progress.total).toBe(0)
		expect(progress.completed).toBe(0)
		expect(progress.isComplete).toBe(true)
	})

	test("isComplete returns true when all checkboxes checked", async () => {
		//#given
		const planPath = writePlan("all-done.md", [
			"- [x] First",
			"- [x] Second",
		].join("\n"))

		//#when
		const result = await provider.isComplete(planPath)

		//#then
		expect(result).toBe(true)
	})

	test("isComplete returns false when some checkboxes unchecked", async () => {
		//#given
		const planPath = writePlan("partial.md", [
			"- [x] First",
			"- [ ] Second",
		].join("\n"))

		//#when
		const result = await provider.isComplete(planPath)

		//#then
		expect(result).toBe(false)
	})

	test("markTaskComplete checks matching unchecked task", async () => {
		//#given
		const planPath = writePlan("tasks.md", [
			"# Plan",
			"- [ ] Implement auth",
			"- [ ] Add tests",
		].join("\n"))

		//#when
		await provider.markTaskComplete(planPath, "Implement auth")

		//#then
		const content = readFileSync(planPath, "utf-8")
		expect(content).toContain("- [x] Implement auth")
		expect(content).toContain("- [ ] Add tests")
	})

	test("markTaskComplete does not modify already checked task", async () => {
		//#given
		const planPath = writePlan("already-done.md", [
			"- [x] Done task",
			"- [ ] Open task",
		].join("\n"))

		//#when
		await provider.markTaskComplete(planPath, "Done task")

		//#then
		const content = readFileSync(planPath, "utf-8")
		expect(content).toBe("- [x] Done task\n- [ ] Open task")
	})

	test("markTaskComplete handles non-existent file gracefully", async () => {
		//#given
		const fakePath = join(testDir, "ghost.md")

		//#when + #then — no throw
		await provider.markTaskComplete(fakePath, "Some task")
	})

	test("markTaskComplete handles task with regex special characters", async () => {
		//#given
		const planPath = writePlan("special.md", [
			"- [ ] Fix bug (issue #42)",
			"- [ ] Normal task",
		].join("\n"))

		//#when
		await provider.markTaskComplete(planPath, "Fix bug (issue #42)")

		//#then
		const content = readFileSync(planPath, "utf-8")
		expect(content).toContain("- [x] Fix bug (issue #42)")
	})

	test("type property returns markdown", () => {
		//#then
		expect(provider.type).toBe("markdown")
	})
})
