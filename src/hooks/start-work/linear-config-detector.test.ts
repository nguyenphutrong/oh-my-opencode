/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectLinearConfigFromDisk } from "./linear-config-detector";

describe("detectLinearConfigFromDisk", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "linear-config-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("returns false when no config files exist", () => {
		//#given
		const directory = testDir;

		//#when
		const result = detectLinearConfigFromDisk(directory);

		//#then
		expect(result).toBe(false);
	});

	test("returns true when oh-my-opencode.json has tracking_provider set to linear", () => {
		//#given
		const configPath = join(testDir, ".opencode", "oh-my-opencode.json");
		mkdirSync(join(testDir, ".opencode"), { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify({ ralph_loop: { tracking_provider: "linear" } }),
		);

		//#when
		const result = detectLinearConfigFromDisk(testDir);

		//#then
		expect(result).toBe(true);
	});

	test("returns true when tracking_provider is auto and team_id is set", () => {
		//#given
		const configPath = join(testDir, ".opencode", "oh-my-opencode.json");
		mkdirSync(join(testDir, ".opencode"), { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify({
				ralph_loop: { tracking_provider: "auto", linear: { team_id: "team-123" } },
			}),
		);

		//#when
		const result = detectLinearConfigFromDisk(testDir);

		//#then
		expect(result).toBe(true);
	});

	test("returns false when tracking_provider is auto but team_id is missing", () => {
		//#given
		const configPath = join(testDir, ".opencode", "oh-my-opencode.json");
		mkdirSync(join(testDir, ".opencode"), { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify({ ralph_loop: { tracking_provider: "auto" } }),
		);

		//#when
		const result = detectLinearConfigFromDisk(testDir);

		//#then
		expect(result).toBe(false);
	});

	test("returns true when mcp.json has server named linear", () => {
		//#given
		const mcpPath = join(testDir, ".mcp.json");
		writeFileSync(
			mcpPath,
			JSON.stringify({ mcpServers: { linear: {} } }),
		);

		//#when
		const result = detectLinearConfigFromDisk(testDir);

		//#then
		expect(result).toBe(true);
	});

	test("returns true when mcp.json has server with url containing mcp.linear.app", () => {
		//#given
		const mcpPath = join(testDir, ".mcp.json");
		writeFileSync(
			mcpPath,
			JSON.stringify({
				mcpServers: {
					"custom-server": { url: "mcp.linear.app" },
				},
			}),
		);

		//#when
		const result = detectLinearConfigFromDisk(testDir);

		//#then
		expect(result).toBe(true);
	});

	test("returns false when mcp.json exists but has no Linear servers", () => {
		//#given
		const mcpPath = join(testDir, ".mcp.json");
		writeFileSync(
			mcpPath,
			JSON.stringify({ mcpServers: { github: {}, filesystem: {} } }),
		);

		//#when
		const result = detectLinearConfigFromDisk(testDir);

		//#then
		expect(result).toBe(false);
	});
});
