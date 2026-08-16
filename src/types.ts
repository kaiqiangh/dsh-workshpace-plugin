import type { SessionId } from "@deepseek-ai/dsh-session";

export type {
  WorkspaceArtifactPreview,
  WorkspaceArtifactBinaryPreview,
  WorkspaceArtifactCsvPreview,
  WorkspaceArtifactErrorPreview,
  WorkspaceArtifactJsonPreview,
  WorkspaceArtifactMarkdownPreview,
  WorkspaceArtifactTextPreview,
  WorkspaceArtifactUnsupportedPreview,
  WorkspaceJsonValue,
} from "./host/workspace-artifacts.ts";
export type {
  WorkspaceDeliverable,
  WorkspaceDeliverablePreview,
  WorkspaceDeliverableSource,
} from "./domain/deliverable.ts";
export type {
  MemoryDraft,
  MemoryListOptions,
  MemoryProvenance,
  MemoryReadState,
  MemoryRecord,
  MemoryScope,
  MemorySearchOptions,
  MemoryStatus,
  MemoryStoreErrorCode,
  MemoryStoreLocationOptions,
  MemoryStoreOptions,
  MemoryStoreWarning,
  MemoryType,
} from "./domain/memory-store.ts";

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
