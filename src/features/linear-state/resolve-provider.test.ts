import { describe, expect, test } from "bun:test"
import { resolveTrackingProvider } from "./resolve-provider"
import type { RalphLoopConfig } from "../../config"

describe("resolveTrackingProvider", () => {
	test("returns 'markdown' when tracking_provider is 'markdown'", () => {
		//#given
		const config: Partial<RalphLoopConfig> = {
			tracking_provider: "markdown",
		}
		const registeredMcps = {}
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config as RalphLoopConfig, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("markdown")
	})

	test("returns 'linear' when tracking_provider is 'linear' and team_id is configured", () => {
		//#given
		const config: Partial<RalphLoopConfig> = {
			tracking_provider: "linear",
			linear: {
				team_id: "TEAM1",
			},
		}
		const registeredMcps = {}
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config as RalphLoopConfig, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("linear")
	})

	test("returns 'markdown' when tracking_provider is 'linear' but no team_id (fallback)", () => {
		//#given
		const config: Partial<RalphLoopConfig> = {
			tracking_provider: "linear",
			linear: {
				team_id: "",
			},
		}
		const registeredMcps = {}
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config as RalphLoopConfig, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("markdown")
	})

	test("returns 'linear' when tracking_provider is 'auto' + Linear MCP detected + team_id configured", () => {
		//#given
		const config: Partial<RalphLoopConfig> = {
			tracking_provider: "auto",
			linear: {
				team_id: "TEAM1",
			},
		}
		const registeredMcps = { linear: {} }
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config as RalphLoopConfig, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("linear")
	})

	test("returns 'markdown' when tracking_provider is 'auto' + Linear MCP detected + no team_id", () => {
		//#given
		const config: Partial<RalphLoopConfig> = {
			tracking_provider: "auto",
			linear: {
				team_id: "",
			},
		}
		const registeredMcps = { "linear-mcp": {} }
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config as RalphLoopConfig, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("markdown")
	})

	test("returns 'markdown' when tracking_provider is 'auto' + no Linear MCP", () => {
		//#given
		const config: Partial<RalphLoopConfig> = {
			tracking_provider: "auto",
			linear: {
				team_id: "TEAM1",
			},
		}
		const registeredMcps = { "other-mcp": {} }
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config as RalphLoopConfig, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("markdown")
	})

	test("returns 'markdown' when config is undefined (default)", () => {
		//#given
		const config = undefined
		const registeredMcps = {}
		const mcpJsonConfig = null

		//#when
		const result = resolveTrackingProvider(config, registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe("markdown")
	})
})
