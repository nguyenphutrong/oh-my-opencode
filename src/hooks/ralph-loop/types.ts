import type { RalphLoopConfig } from "../../config"
import type { TrackingStateProvider } from "../../features/linear-state/types"

export interface RalphLoopState {
  active: boolean
  iteration: number
  max_iterations: number
  completion_promise: string
  started_at: string
  prompt: string
  session_id?: string
  ultrawork?: boolean
  plan_ref?: string
}

export interface RalphLoopOptions {
  config?: RalphLoopConfig
  getTranscriptPath?: (sessionId: string) => string
  apiTimeout?: number
  checkSessionExists?: (sessionId: string) => Promise<boolean>
  trackingProvider?: TrackingStateProvider
}

export type SessionRecovery = {
  isRecovering: (sessionID: string) => boolean
  markRecovering: (sessionID: string) => void
  clear: (sessionID: string) => void
}

export type LoopStateController = {
  getState: () => RalphLoopState | null
  clear: () => boolean
  incrementIteration: () => RalphLoopState | null
}

export type RalphLoopEventHandlerOptions = {
  directory: string
  apiTimeoutMs: number
  getTranscriptPath: (sessionID: string) => string | undefined
  checkSessionExists?: RalphLoopOptions["checkSessionExists"]
  sessionRecovery: SessionRecovery
  loopState: LoopStateController
  trackingProvider?: TrackingStateProvider & { findNextOpenIssueId?: () => string | null }
}
