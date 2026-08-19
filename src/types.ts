import type { SessionId } from "@deepseek-ai/dsh-session";
import type { MemoryType } from "./domain/memory-store.ts";
export type { MemoryType };
export type { GitChange, GitChangeStatus, GitCommit, GitCommitFile, GitCommitResult, GitDiffResult, GitErrorCode, GitHistoryOptions, GitRepoInfo } from "./domain/git.ts";

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
  MemoryMigration,
  MemoryConfidence,
  MemoryContentHash,
  MemoryGovernance,
  MemoryOrigin,
  MemoryRetention,
  MemorySourceRef,
  MemoryVerification,
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
} from "./domain/memory-store.ts";
export type { MemoryScopeRequest, MemoryWorkspaceContext } from "./domain/memory.ts";
export type { WorkspaceSummaryData } from "./host/workspace-summary.ts";
export type {
  MemoryGovernanceAction,
  MemoryGovernanceErrorCode,
  MemoryExportBundle,
  MemoryRevisionConflict,
} from "./domain/memory-governance.ts";

/**
 * Canonical record types, defined here (not in the node-bound store module)
 * so client bundles can reference the values without pulling in node:crypto.
 */
export const MEMORY_TYPES: readonly MemoryType[] = ["decision", "preference", "convention", "fact"];

export type AgentId = SessionId;

