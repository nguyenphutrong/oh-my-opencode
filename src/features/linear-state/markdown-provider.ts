import type { PlanProgress, TrackingStateProvider } from "./types"
import { getPlanProgress } from "../boulder-state/storage"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { log } from "../../shared/logger"

const LOG_PREFIX = "[markdown-provider]"

export function createMarkdownStateProvider(): TrackingStateProvider {
	return {
		type: "markdown",

		async getProgress(planRef: string): Promise<PlanProgress> {
			return getPlanProgress(planRef)
		},

		async markTaskComplete(planRef: string, taskId: string): Promise<void> {
			try {
				if (!existsSync(planRef)) return

				const content = readFileSync(planRef, "utf-8")
				const updated = checkTaskInMarkdown(content, taskId)
				if (updated !== content) {
					writeFileSync(planRef, updated, "utf-8")
				}
			} catch (error) {
				log(`${LOG_PREFIX} markTaskComplete failed`, {
					planRef,
					taskId,
					error: String(error),
				})
			}
		},

		async isComplete(planRef: string): Promise<boolean> {
			const progress = getPlanProgress(planRef)
			return progress.isComplete
		},
	}
}

function checkTaskInMarkdown(content: string, taskId: string): string {
	const lines = content.split("\n")
	const taskPattern = new RegExp(
		`^([-*]\\s*)\\[\\s*\\](\\s+${escapeRegex(taskId)}.*)$`,
	)

	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(taskPattern)
		if (match) {
			lines[i] = `${match[1]}[x]${match[2]}`
			break
		}
	}

	return lines.join("\n")
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
