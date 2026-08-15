import { type WorkspaceIdentity, type WorkspacePath } from "./workspace.ts";
export type PinnedContextSourceStatus = "pending" | "ready" | "stale" | "unreadable" | "unsupported" | "oversized";
export type PinnedContextStatus = PinnedContextSourceStatus | "over-budget" | "capacity-unavailable";
export type PinnedContextOmissionReason = "per-item-bytes" | "context-budget" | "model-capacity" | "capacity-unavailable" | "unreadable" | "stale" | "unsupported" | "oversized";
export interface PinnedContextLimits {
    readonly maxItems: number;
    readonly maxItemBytes: number;
    readonly maxTokens: number;
    readonly reservedOutputTokens: number;
}
export interface PinnedContextEntry {
    readonly path: WorkspacePath;
    readonly order: number;
    readonly sourceStatus: PinnedContextSourceStatus;
    readonly status: PinnedContextStatus;
    readonly contentHash?: string;
    readonly bytes?: number;
    readonly estimatedTokens?: number;
    readonly loadedAt?: number;
    readonly omissionReason?: PinnedContextOmissionReason;
    readonly reason?: string;
    /** Host-only content used to form the next model snapshot; never send entries directly to Web. */
    readonly content?: string;
}
export interface PinnedContextState {
    readonly identity: WorkspaceIdentity;
    readonly limits: PinnedContextLimits;
    readonly capacityTokens?: number;
    readonly entries: readonly PinnedContextEntry[];
    readonly admittedTokens: number;
    readonly availableBudgetTokens: number;
    readonly remainingTokens: number;
}
export interface PinnedContextReadyUpdate {
    readonly path: string;
    readonly status: "ready";
    readonly content: string;
    readonly loadedAt: number;
    readonly identity?: WorkspaceIdentity;
}
export interface PinnedContextUnavailableUpdate {
    readonly path: string;
    readonly status: Exclude<PinnedContextSourceStatus, "pending" | "ready">;
    readonly reason: string;
    readonly loadedAt?: number;
    readonly identity?: WorkspaceIdentity;
}
export type PinnedContextUpdate = PinnedContextReadyUpdate | PinnedContextUnavailableUpdate;
export interface PinnedContextSnapshot {
    readonly identity: WorkspaceIdentity;
    readonly entries: readonly PinnedContextEntry[];
    readonly sections: readonly {
        readonly name: string;
        readonly text: string;
    }[];
    readonly text: string;
    readonly estimatedTokens: number;
}
export type PinnedContextMetadata = Omit<PinnedContextEntry, "content">;
export declare class PinnedContextError extends Error {
    readonly code: "INVALID_LIMIT" | "IDENTITY_MISMATCH" | "PATH_INVALID" | "MAX_ITEMS" | "ENTRY_NOT_PINNED";
    constructor(code: PinnedContextError["code"], message: string);
}
export declare function hashPinnedContextContent(content: string): string;
/** Public Harness-compatible heuristic: four characters per token plus block and role framing. */
export declare function estimatePinnedContextTokens(text: string): number;
export declare function createPinnedContext(identity: WorkspaceIdentity, limits?: Partial<PinnedContextLimits>): PinnedContextState;
export declare function pinContextPath(state: PinnedContextState, input: string): PinnedContextState;
export declare function updateContextPath(state: PinnedContextState, update: PinnedContextUpdate): PinnedContextState;
export declare function setContextCapacity(state: PinnedContextState, capacityTokens: number | undefined): PinnedContextState;
export declare function unpinContextPath(state: PinnedContextState, input: string): PinnedContextState;
export declare function clearPinnedContext(state: PinnedContextState): PinnedContextState;
export declare function renderPinnedContext(state: PinnedContextState): PinnedContextSnapshot;
/** Return browser-safe metadata without the host-only model content. */
export declare function pinnedContextMetadata(state: PinnedContextState): readonly PinnedContextMetadata[];
