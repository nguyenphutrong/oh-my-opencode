import type { AgentOverrides } from "../../config"
import type { BackgroundManager } from "../../features/background-agent"
import type { TrackingStateProvider } from "../../features/linear-state/types"

export type ModelInfo = { providerID: string; modelID: string }

export interface AtlasHookOptions {
  directory: string
  backgroundManager?: BackgroundManager
  isContinuationStopped?: (sessionID: string) => boolean
  agentOverrides?: AgentOverrides
  trackingProvider?: TrackingStateProvider
}

export interface ToolExecuteAfterInput {
  tool: string
  sessionID?: string
  callID?: string
}

export interface ToolExecuteAfterOutput {
  title: string
  output: string
  metadata: Record<string, unknown>
}

export interface SessionState {
  lastEventWasAbortError?: boolean
  lastContinuationInjectedAt?: number
  promptFailureCount: number
}
