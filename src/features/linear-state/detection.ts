const LINEAR_MCP_NAMES = ["linear", "linear-mcp", "@cline/linear-mcp"]
const LINEAR_URL_PATTERN = "mcp.linear.app"

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
	return Object.keys(registeredMcps).some(matchesLinearName)
}

function hasLinearInMcpJson(
	mcpJsonConfig: Record<string, unknown> | null,
): boolean {
	if (!mcpJsonConfig) return false

	const servers = getMcpServers(mcpJsonConfig)
	if (!servers) return false

	for (const [name, config] of Object.entries(servers)) {
		if (matchesLinearName(name)) return true
		if (matchesLinearUrl(config)) return true
	}
	return false
}

function getMcpServers(
	config: Record<string, unknown>,
): Record<string, unknown> | null {
	if ("mcpServers" in config && typeof config.mcpServers === "object" && config.mcpServers !== null) {
		return config.mcpServers as Record<string, unknown>
	}
	return null
}

export function matchesLinearName(key: string): boolean {
	return LINEAR_MCP_NAMES.includes(key.toLowerCase())
}

function matchesLinearUrl(serverConfig: unknown): boolean {
	if (typeof serverConfig !== "object" || serverConfig === null) return false
	const config = serverConfig as Record<string, unknown>
	return typeof config.url === "string" && config.url.includes(LINEAR_URL_PATTERN)
}
