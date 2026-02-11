import type { RalphLoopConfig } from "../../config"
import type { ResolvedProvider } from "./types"
import { detectLinearMcp } from "./detection"
import { log } from "../../shared/logger"

const LOG_PREFIX = "[tracking-provider]"

export function resolveTrackingProvider(
	config: RalphLoopConfig | undefined,
	registeredMcps: Record<string, unknown>,
	mcpJsonConfig: Record<string, unknown> | null,
): ResolvedProvider {
	const explicit = config?.tracking_provider ?? "auto"

	if (explicit === "markdown") return "markdown"

	if (explicit === "linear") {
		return resolveExplicitLinear(config)
	}

	return resolveAutoDetect(config, registeredMcps, mcpJsonConfig)
}

function resolveExplicitLinear(
	config: RalphLoopConfig | undefined,
): ResolvedProvider {
	if (!config?.linear?.team_id) {
		log(
			`${LOG_PREFIX} tracking_provider=linear but no linear.team_id configured. Falling back to markdown.`,
		)
		return "markdown"
	}
	return "linear"
}

function resolveAutoDetect(
	config: RalphLoopConfig | undefined,
	registeredMcps: Record<string, unknown>,
	mcpJsonConfig: Record<string, unknown> | null,
): ResolvedProvider {
	const hasLinearMcp = detectLinearMcp(registeredMcps, mcpJsonConfig)
	const hasTeamId = !!config?.linear?.team_id

	if (hasLinearMcp && hasTeamId) {
		log(
			`${LOG_PREFIX} Linear MCP detected + team_id configured → using Linear provider`,
		)
		return "linear"
	}

	if (hasLinearMcp && !hasTeamId) {
		log(
			`${LOG_PREFIX} Linear MCP detected but no team_id → using markdown (set ralph_loop.linear.team_id to enable)`,
		)
	}

	return "markdown"
}
