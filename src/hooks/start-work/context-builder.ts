import {
	readBoulderState,
	writeBoulderState,
	appendSessionId,
	createBoulderState,
	clearBoulderState,
	getPlanProgress,
	getPlanName,
} from "../../features/boulder-state"
import { setActiveIssue } from "../../features/linear-state/shadow-cache"
import { detectLinearConfigFromDisk } from "./linear-config-detector"
import {
	discoverMarkdownPlans,
	discoverLinearIssues,
	findPlanByName,
	type PlanCandidate,
} from "./plan-discovery"
import { findPrometheusPlans } from "../../features/boulder-state"

interface BuildContextArgs {
	directory: string
	sessionId: string
	timestamp: string
	explicitPlanName: string | null
}

export function buildStartWorkContext(args: BuildContextArgs): string {
	const { directory, sessionId, timestamp, explicitPlanName } = args

	if (explicitPlanName) {
		return handleExplicitPlan(directory, sessionId, timestamp, explicitPlanName)
	}

	const existingState = readBoulderState(directory)

	if (existingState) {
		const resumeResult = handleExistingBoulder(directory, sessionId, existingState)
		if (resumeResult !== null) return resumeResult
	}

	return handlePlanDiscovery(directory, sessionId, timestamp)
}

function handleExplicitPlan(
	directory: string,
	sessionId: string,
	timestamp: string,
	explicitPlanName: string,
): string {
	const allPlans = findPrometheusPlans(directory)
	const matchedPlan = findPlanByName(allPlans, explicitPlanName)

	if (matchedPlan) {
		const progress = getPlanProgress(matchedPlan)
		if (progress.isComplete) {
			return `\n## Plan Already Complete\n\nThe requested plan "${getPlanName(matchedPlan)}" has been completed.\nAll ${progress.total} tasks are done. Create a new plan with: /plan "your task"`
		}
		clearBoulderState(directory)
		const newState = createBoulderState(matchedPlan, sessionId, "atlas")
		writeBoulderState(directory, newState)
		return formatAutoSelectedPlan(getPlanName(matchedPlan), matchedPlan, progress.completed, progress.total, sessionId, timestamp, "markdown")
	}

	const incompletePlans = allPlans.filter((p) => !getPlanProgress(p).isComplete)
	if (incompletePlans.length > 0) {
		const planList = incompletePlans
			.map((p, i) => `${i + 1}. [${getPlanName(p)}] - Progress: ${getPlanProgress(p).completed}/${getPlanProgress(p).total}`)
			.join("\n")
		return `\n## Plan Not Found\n\nCould not find a plan matching "${explicitPlanName}".\n\nAvailable incomplete plans:\n${planList}\n\nAsk the user which plan to work on.`
	}

	return `\n## Plan Not Found\n\nCould not find a plan matching "${explicitPlanName}".\nNo incomplete plans available. Create a new plan with: /plan "your task"`
}

function handleExistingBoulder(
	directory: string,
	sessionId: string,
	existingState: ReturnType<typeof readBoulderState> & {},
): string | null {
	if (existingState.tracking_provider === "linear" && existingState.linear_issue_id) {
		appendSessionId(directory, sessionId)
		return `\n## Active Linear Work Session Found\n\n**Status**: RESUMING existing work\n**Issue**: ${existingState.linear_issue_id}\n**Provider**: linear\n**Sessions**: ${existingState.session_ids.length + 1} (current session appended)\n**Started**: ${existingState.started_at}\n\nUse Linear MCP \`get_issue\` to check current progress and continue from first incomplete sub-issue.\nMark sub-issues as Done via \`update_issue\` when completed.`
	}

	const progress = getPlanProgress(existingState.active_plan)
	if (!progress.isComplete) {
		appendSessionId(directory, sessionId)
		return `\n## Active Work Session Found\n\n**Status**: RESUMING existing work\n**Plan**: ${existingState.plan_name}\n**Path**: ${existingState.active_plan}\n**Progress**: ${progress.completed}/${progress.total} tasks completed\n**Sessions**: ${existingState.session_ids.length + 1} (current session appended)\n**Started**: ${existingState.started_at}\n\nThe current session (${sessionId}) has been added to session_ids.\nRead the plan file and continue from the first unchecked task.`
	}

	return null
}

function handlePlanDiscovery(
	directory: string,
	sessionId: string,
	timestamp: string,
): string {
	const linearCandidates = discoverLinearIssues(directory)
	const markdownCandidates = discoverMarkdownPlans(directory).filter((p) => !p.isComplete)
	const allCandidates = [...linearCandidates, ...markdownCandidates]

	if (allCandidates.length === 0) {
		if (detectLinearConfigFromDisk(directory)) {
			return formatLinearFirstRunInstructions(sessionId, timestamp)
		}
		return `\n## No Plans Found\n\nNo Prometheus plan files at .sisyphus/plans/ and no open Linear issues in shadow cache.\nUse Prometheus to create a work plan: /plan "your task"\nOr search Linear for open issues: use Linear MCP \`search_issues\``
	}

	if (allCandidates.length === 1) {
		const candidate = allCandidates[0]
		return autoSelectCandidate(directory, candidate, sessionId, timestamp)
	}

	return formatMultipleCandidates(allCandidates, timestamp, sessionId)
}

function autoSelectCandidate(
	directory: string,
	candidate: PlanCandidate,
	sessionId: string,
	timestamp: string,
): string {
	if (candidate.provider === "linear") {
		const newState = createBoulderState(
			candidate.id,
			sessionId,
			"atlas",
			{ tracking_provider: "linear", linear_issue_id: candidate.id },
		)
		// Override plan_name: createBoulderState derives it from file path,
		// but for Linear issues the ID is not a path - use the issue title instead.
		newState.plan_name = candidate.name
		writeBoulderState(directory, newState)
		setActiveIssue(directory, candidate.id)
		return formatAutoSelectedPlan(candidate.name, candidate.id, candidate.completed, candidate.total, sessionId, timestamp, "linear")
	}

	const newState = createBoulderState(candidate.id, sessionId, "atlas")
	writeBoulderState(directory, newState)
	return formatAutoSelectedPlan(candidate.name, candidate.id, candidate.completed, candidate.total, sessionId, timestamp, "markdown")
}

function formatAutoSelectedPlan(
	name: string, path: string, completed: number, total: number,
	sessionId: string, timestamp: string, provider: "markdown" | "linear",
): string {
	const providerLine = provider === "linear" ? `\n**Provider**: linear\n\n**MANDATORY STEPS** (execute in order):\n1. Call Linear MCP \`get_workflow_states\` to fetch team workflow states\n2. Call Linear MCP \`update_issue\` to set this issue status to "In Progress" (use the started state ID from workflow states)\n3. Call Linear MCP \`get_issue\` to fetch full issue details and sub-issues\n4. Execute sub-issues one by one\n5. Mark each sub-issue as "Done" via \`update_issue\` when completed` : ""
	return `\n## Auto-Selected Plan\n\n**Plan**: ${name}\n**Path**: ${path}\n**Progress**: ${completed}/${total} tasks\n**Session ID**: ${sessionId}\n**Started**: ${timestamp}${providerLine}\n\nboulder.json has been created. Read the plan and begin execution.`
}

function formatLinearFirstRunInstructions(sessionId: string, timestamp: string): string {
	return `\n<system-reminder>\n## Linear Mode — First Run Setup\n\n**Session ID**: ${sessionId}\n**Started**: ${timestamp}\n**Provider**: linear\n\nNo local cache exists yet. You MUST bootstrap the Linear cache by executing these steps IN ORDER:\n\n1. **Fetch workflow states**: Call Linear MCP \`get_workflow_states\` to get team workflow state IDs (In Progress, Done, etc.)\n2. **Search for open issues**: Call Linear MCP \`search_issues\` to find all open issues for the configured team\n3. **Pick the first open issue**: Select the first unstarted/backlog issue from results\n4. **Set it to "In Progress"**: Call Linear MCP \`update_issue\` with the started state ID\n5. **Fetch full details**: Call Linear MCP \`get_issue\` on the selected issue to get sub-issues\n6. **Begin execution**: Execute sub-issues one by one, marking each as "Done" via \`update_issue\`\n\nThe shadow cache will be auto-populated from your MCP tool responses (via linear-mcp-interceptor hook).\nAfter the first search, subsequent /start-work calls will find cached issues automatically.\n</system-reminder>`
}

function formatMultipleCandidates(
	candidates: PlanCandidate[],
	timestamp: string,
	sessionId: string,
): string {
	const list = candidates.map((c, i) => {
		const providerTag = c.provider === "linear" ? " [Linear]" : " [Markdown]"
		return `${i + 1}. [${c.name}]${providerTag} - Progress: ${c.completed}/${c.total}`
	}).join("\n")

	return `\n<system-reminder>\n## Multiple Plans Found\n\nCurrent Time: ${timestamp}\nSession ID: ${sessionId}\n\n${list}\n\nAsk the user which plan to work on. Present the options above and wait for their response.\n</system-reminder>`
}
