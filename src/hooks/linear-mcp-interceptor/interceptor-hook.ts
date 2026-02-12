import { matchesLinearName } from "../../features/linear-state/detection"
import { log } from "../../shared/logger"
import { handleLinearResponse, safeJsonParse } from "./response-handler"

const LOG_PREFIX = "[linear-mcp-interceptor]"

export function createLinearMcpInterceptorHook(directory: string) {
	interface PendingCall {
		mcpName: string
		toolName: string
		args: Record<string, unknown>
		storedAt: number
	}

	const pendingCalls = new Map<string, PendingCall>()
	const STALE_MS = 5 * 60 * 1000

	function makeKey(sessionID: string, callID: string): string {
		return `${sessionID}:${callID}`
	}

	function cleanupStale(): void {
		const now = Date.now()
		for (const [key, entry] of pendingCalls) {
			if (now - entry.storedAt > STALE_MS) pendingCalls.delete(key)
		}
	}

	return {
		"tool.execute.before": async (
			input: { tool: string; sessionID: string; callID: string },
			output: { args: Record<string, unknown> },
		): Promise<void> => {
			if (input.tool !== "skill_mcp") return

			const mcpName = typeof output.args.mcp_name === "string" ? output.args.mcp_name : ""
			if (!matchesLinearName(mcpName)) return

			const toolName = typeof output.args.tool_name === "string" ? output.args.tool_name : ""
			if (!toolName) return

			cleanupStale()
			const rawArgs = output.args.arguments
			const parsedArgs: Record<string, unknown> =
				typeof rawArgs === "string" ? safeJsonParse(rawArgs) :
				typeof rawArgs === "object" && rawArgs !== null ? rawArgs as Record<string, unknown> :
				{}

			pendingCalls.set(makeKey(input.sessionID, input.callID), {
				mcpName,
				toolName,
				args: parsedArgs,
				storedAt: Date.now(),
			})
		},

		"tool.execute.after": async (
			input: { tool: string; sessionID: string; callID: string },
			output: { title: string; output: string; metadata: Record<string, unknown> },
		): Promise<void> => {
			if (input.tool !== "skill_mcp") return

			const key = makeKey(input.sessionID, input.callID)
			const pending = pendingCalls.get(key)
			if (!pending) return
			pendingCalls.delete(key)

			try {
				const responseData = safeJsonParse(output.output)
				handleLinearResponse(directory, pending.toolName, pending.args, responseData)
			} catch (error) {
				log(`${LOG_PREFIX} failed to process response`, {
					toolName: pending.toolName,
					error: String(error),
				})
			}
		},
	}
}
