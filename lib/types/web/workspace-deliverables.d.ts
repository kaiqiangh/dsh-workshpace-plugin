import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import type { PreviewDescriptor } from "../domain/preview.ts";
export type { WorkspaceDeliverable, WorkspaceDeliverablePreview, WorkspaceDeliverableSource } from "../domain/deliverable.ts";
export type WorkspaceArtifactDetailStatus = "idle" | "loading" | "ready" | "unsupported" | "oversized" | "stale" | "deleted" | "error";
export interface WorkspaceArtifactView {
    readonly items: readonly WorkspaceDeliverable[];
    readonly selected?: WorkspaceDeliverable;
}
export interface WorkspaceArtifactDetail {
    readonly artifact: WorkspaceDeliverable;
    readonly descriptor?: PreviewDescriptor;
    readonly status: WorkspaceArtifactDetailStatus;
    readonly message?: string;
}
export type WorkspaceDownloadStatus = "ready" | "cancelled" | "unsupported" | "oversized" | "stale" | "error";
export interface WorkspaceDownloadResult {
    readonly status: WorkspaceDownloadStatus;
    readonly url?: string;
    readonly downloadName?: string;
    readonly message?: string;
}
export interface WorkspaceFetchResponse {
    readonly ok: boolean;
    readonly status: number;
    readonly blob: () => Promise<Blob>;
}
export interface WorkspaceDownloadRuntime {
    readonly fetch: (url: string, init: {
        readonly signal: AbortSignal;
    }) => Promise<WorkspaceFetchResponse>;
    readonly createObjectURL: (blob: Blob) => string;
    readonly revokeObjectURL: (url: string) => void;
}
/** Validate and deterministically order metadata with safe logical locations. */
export declare function normalizeWorkspaceArtifacts(input: readonly WorkspaceDeliverable[]): readonly WorkspaceDeliverable[];
export declare function createWorkspaceArtifactView(input: readonly WorkspaceDeliverable[], selectedId?: string): WorkspaceArtifactView;
export declare function createWorkspaceArtifactDetail(artifact: WorkspaceDeliverable, descriptor?: PreviewDescriptor): WorkspaceArtifactDetail;
export interface WorkspaceResourceUrlOptions {
    readonly download?: boolean;
    readonly resourcePath?: string;
}
/** Single authorized opaque-resource URL builder shared by preview + download paths. */
export declare function workspaceResourceUrl(resourceId: string, mediaType: string, options?: WorkspaceResourceUrlOptions): string | undefined;
export declare function buildWorkspaceResourceUrl(artifact: WorkspaceDeliverable, resourcePath?: string): string | undefined;
/** Own one cancellable browser download and its object-URL cleanup. */
export declare function createWorkspaceDownloadController(runtime: WorkspaceDownloadRuntime, resourcePath?: string): {
    cancel(): void;
    release(url: string): void;
    start(artifact: WorkspaceDeliverable): Promise<WorkspaceDownloadResult>;
};
