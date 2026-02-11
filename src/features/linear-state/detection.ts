const LINEAR_MCP_PATTERNS = ["linear", "linear-mcp", "@cline/linear-mcp"]

export function detectLinearMcp(
	registeredMcps: Record<string, unknown>,
	mcpJsonConfig: Record<string, unknown> | null,
): boolean {
	if (hasLinearInRegistry(registeredMcps)) return true
	if (hasLinearInMcpJson(mcpJsonConfig)) return true
	return false
}

function hasLinearInRegistry(
	registeredMcps: Record<string, unknown>,
): boolean {
	return Object.keys(registeredMcps).some(matchesLinearPattern)
}

function hasLinearInMcpJson(
	mcpJsonConfig: Record<string, unknown> | null,
): boolean {
	if (!mcpJsonConfig) return false

	const servers = (
		mcpJsonConfig as { mcpServers?: Record<string, unknown> }
	).mcpServers
	if (!servers) return false

	return Object.keys(servers).some(matchesLinearPattern)
}

function matchesLinearPattern(key: string): boolean {
	const normalized = key.toLowerCase()
	return LINEAR_MCP_PATTERNS.some(
		(pattern) =>
			normalized === pattern || normalized.includes("linear"),
	)
}
