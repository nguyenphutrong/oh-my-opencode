import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const CONFIG_LOCATIONS = [
	(dir: string) => join(dir, ".opencode", "oh-my-opencode.json"),
	(dir: string) => join(dir, ".opencode", "oh-my-opencode.jsonc"),
] as const

const USER_CONFIG_LOCATIONS = [
	() => join(process.env.HOME ?? "", ".config", "opencode", "oh-my-opencode.json"),
	() => join(process.env.HOME ?? "", ".config", "opencode", "oh-my-opencode.jsonc"),
] as const

const MCP_CONFIG_LOCATIONS = [
	(dir: string) => join(dir, ".mcp.json"),
	(dir: string) => join(dir, ".opencode", "mcp.json"),
] as const

const LINEAR_MCP_NAMES = ["linear", "linear-mcp", "@cline/linear-mcp"]
const LINEAR_URL_PATTERN = "mcp.linear.app"

export function detectLinearConfigFromDisk(directory: string): boolean {
	return hasLinearTrackingConfig(directory) || hasLinearMcpConfig(directory)
}

function hasLinearTrackingConfig(directory: string): boolean {
	const allLocations = [
		...CONFIG_LOCATIONS.map((fn) => fn(directory)),
		...USER_CONFIG_LOCATIONS.map((fn) => fn()),
	]

	for (const configPath of allLocations) {
		const content = readJsonSafe(configPath)
		if (!content) continue
		const trackingProvider = getNestedString(content, "ralph_loop", "tracking_provider")
		if (trackingProvider === "linear") return true
		if (trackingProvider === "auto" && getNestedString(content, "ralph_loop", "linear", "team_id")) return true
	}
	return false
}

function hasLinearMcpConfig(directory: string): boolean {
	const mcpPaths = MCP_CONFIG_LOCATIONS.map((fn) => fn(directory))

	for (const mcpPath of mcpPaths) {
		const content = readJsonSafe(mcpPath)
		if (!content) continue

		const servers = typeof content.mcpServers === "object" && content.mcpServers !== null
			? content.mcpServers as Record<string, unknown>
			: null
		if (!servers) continue

		for (const [name, config] of Object.entries(servers)) {
			if (LINEAR_MCP_NAMES.includes(name.toLowerCase())) return true
			if (typeof config === "object" && config !== null) {
				const url = (config as Record<string, unknown>).url
				if (typeof url === "string" && url.includes(LINEAR_URL_PATTERN)) return true
			}
		}
	}
	return false
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
	if (!existsSync(filePath)) return null
	try {
		const raw = readFileSync(filePath, "utf-8")
		const cleaned = raw.replace(/\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")
		const parsed = JSON.parse(cleaned)
		return typeof parsed === "object" && parsed !== null ? parsed : null
	} catch {
		return null
	}
}

function getNestedString(obj: Record<string, unknown>, ...keys: string[]): string | null {
	let current: unknown = obj
	for (const key of keys) {
		if (typeof current !== "object" || current === null) return null
		current = (current as Record<string, unknown>)[key]
	}
	return typeof current === "string" ? current : null
}
