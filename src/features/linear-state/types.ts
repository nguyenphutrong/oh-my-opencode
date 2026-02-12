import type { PlanProgress } from "../boulder-state/types"

export interface LinearIssue {
	id: string
	identifier: string
	title: string
	description: string
	state: {
		id: string
		name: string
		type: LinearStateType
	}
	labels: LinearLabel[]
	subIssues?: LinearIssue[]
}

export type LinearStateType =
	| "backlog"
	| "unstarted"
	| "started"
	| "completed"
	| "canceled"

export interface LinearLabel {
	id: string
	name: string
}

export interface LinearMcpClient {
	callTool: (
		name: string,
		args: Record<string, unknown>,
	) => Promise<unknown>
}

export interface TrackingStateProvider {
	type: "markdown" | "linear"

	getProgress(planRef: string): Promise<PlanProgress>

	markTaskComplete(planRef: string, taskId: string): Promise<void>

	isComplete(planRef: string): Promise<boolean>
}

export type { PlanProgress }

export type ResolvedProvider = "markdown" | "linear"
