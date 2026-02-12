import { z } from "zod"

export const TrackingProviderSchema = z.enum(["auto", "markdown", "linear"])
export type TrackingProvider = z.infer<typeof TrackingProviderSchema>

export const LinearTrackingConfigSchema = z.object({
  /** Linear team ID (required for Linear tracking) */
  team_id: z.string(),
  /** Label prefix for iteration tracking (default: "ralph-iteration") */
  label_prefix: z.string().default("ralph-iteration"),
  /** Keep local .md backup alongside Linear (default: true) */
  shadow_cache: z.boolean().default(true),
})

export type LinearTrackingConfig = z.infer<typeof LinearTrackingConfigSchema>

export const RalphLoopConfigSchema = z.object({
  /** Enable ralph loop functionality (default: false - opt-in feature) */
  enabled: z.boolean().default(false),
  /** Default max iterations if not specified in command (default: 100) */
  default_max_iterations: z.number().min(1).max(1000).default(100),
  /** Custom state file directory relative to project root (default: .opencode/) */
  state_dir: z.string().optional(),
  /**
   * Tracking provider for plan/task state management.
   * - "auto": detect Linear MCP → use if available + team_id configured, else markdown
   * - "markdown": always use local .sisyphus/plans/*.md (current behavior)
   * - "linear": always use Linear issues (requires Linear MCP + team_id)
   * @default "auto"
   */
  tracking_provider: TrackingProviderSchema.default("auto"),
  /** Linear-specific configuration (required when tracking_provider is "linear" or "auto" with Linear MCP) */
  linear: LinearTrackingConfigSchema.optional(),
})

export type RalphLoopConfig = z.infer<typeof RalphLoopConfigSchema>
