import { describe, expect, test } from "bun:test"
import { detectLinearMcp } from "./detection"

describe("detectLinearMcp", () => {
	test("returns true when 'linear' key exists in registeredMcps", () => {
		//#given
		const registeredMcps = { linear: {} }
		const mcpJsonConfig = null

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(true)
	})

	test("returns true when 'linear-mcp' key exists in mcpJsonConfig.mcpServers", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"linear-mcp": {},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(true)
	})

	test("returns true when '@cline/linear-mcp' key exists in mcpJsonConfig.mcpServers", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"@cline/linear-mcp": {},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(true)
	})

	test("returns true when server URL matches mcp.linear.app (HTTP)", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"my-project-tracker": {
					type: "http",
					url: "https://mcp.linear.app/mcp",
				},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(true)
	})

	test("returns true when server URL matches mcp.linear.app (SSE)", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"custom-name": {
					type: "sse",
					url: "https://mcp.linear.app/sse",
				},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(true)
	})

	test("returns false when name contains 'linear' but is not an exact match and URL does not match", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"non-linear-solver": {
					type: "http",
					url: "https://example.com/api",
				},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(false)
	})

	test("returns false when no linear-related keys exist", () => {
		//#given
		const registeredMcps = { "other-mcp": {} }
		const mcpJsonConfig = {
			mcpServers: {
				"other-server": {},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(false)
	})

	test("returns false when mcpJsonConfig is null", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = null

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(false)
	})

	test("returns false when both registeredMcps and mcpJsonConfig are empty", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = { mcpServers: {} }

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(false)
	})

	test("returns true when name doesn't match but URL contains mcp.linear.app", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"issue-tracker": {
					url: "https://mcp.linear.app/mcp",
				},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(true)
	})

	test("returns false when server config has no url field", () => {
		//#given
		const registeredMcps = {}
		const mcpJsonConfig = {
			mcpServers: {
				"some-server": {
					command: "npx",
					args: ["some-mcp"],
				},
			},
		}

		//#when
		const result = detectLinearMcp(registeredMcps, mcpJsonConfig)

		//#then
		expect(result).toBe(false)
	})
})
