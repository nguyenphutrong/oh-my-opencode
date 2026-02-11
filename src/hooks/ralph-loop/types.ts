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
