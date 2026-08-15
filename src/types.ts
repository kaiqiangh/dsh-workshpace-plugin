import type { SessionId } from "@deepseek-ai/dsh-session";

export type AgentId = SessionId;

export interface PinnedContextRemoteSnapshot {
  readonly version: number;
  readonly contentHash: string;
  readonly estimatedTokens: number;
  readonly capacityTokens: number;
  readonly admittedTokens: number;
  readonly availableBudgetTokens: number;
  readonly remainingTokens: number;
  readonly status: "ready" | "omitted";
  readonly omissionReason: string;
}
