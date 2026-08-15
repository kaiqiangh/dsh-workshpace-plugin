import { type BoundedTextRead, type PreviewService } from "./preview.ts";
import { type PinnedContextState } from "./context.ts";
import type { WorkspacePath } from "./workspace.ts";
export type PinnedContextRefreshReason = "activity" | "resume" | "assembly";
export interface PinnedContextReader {
    read(path: string, maxBytes: number, signal?: AbortSignal): Promise<BoundedTextRead>;
}
export interface PinnedContextRefreshResult {
    readonly state: PinnedContextState;
    readonly reason: PinnedContextRefreshReason;
    readonly changed: boolean;
    readonly cancelled: boolean;
    readonly refreshedPaths: readonly WorkspacePath[];
}
export type PinnedContextRefreshErrorCode = "DISPOSED" | "IDENTITY_MISMATCH";
export declare class PinnedContextRefreshError extends Error {
    readonly code: PinnedContextRefreshErrorCode;
    constructor(code: PinnedContextRefreshErrorCode, message: string);
}
export declare function previewContextReader(preview: PreviewService): PinnedContextReader;
export declare class PinnedContextRefreshController {
    private stateValue;
    private readonly reader;
    private readonly publish?;
    private readonly pendingReasons;
    private generation;
    private activeAbort?;
    private disposed;
    constructor(state: PinnedContextState, reader: PinnedContextReader, options?: {
        readonly publish?: (state: PinnedContextState) => void;
    });
    get state(): PinnedContextState;
    request(reason: PinnedContextRefreshReason): void;
    flushAtAssembly(): Promise<PinnedContextRefreshResult>;
    restore(state: PinnedContextState): void;
    refresh(reason: PinnedContextRefreshReason): Promise<PinnedContextRefreshResult>;
    dispose(): void;
    private assertActive;
    private isCancelled;
    private cancelledResult;
}
