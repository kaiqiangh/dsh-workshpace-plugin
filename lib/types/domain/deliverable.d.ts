import type { PreviewDescriptor } from "./preview.ts";
import { type WorkspaceIdentity, type WorkspacePath } from "./workspace.ts";
export type WorkspaceDeliverablePreview = "available" | "unsupported" | "oversized" | "stale";
export interface WorkspaceDeliverableSource {
    readonly identity: WorkspaceIdentity;
    readonly path: WorkspacePath;
    readonly kind: "artifact" | "file";
    readonly createdAt?: number;
}
export interface WorkspaceDeliverable {
    readonly id: string;
    readonly name: string;
    readonly mediaType: string;
    readonly sizeBytes: number;
    readonly source: WorkspaceDeliverableSource;
    readonly preview: WorkspaceDeliverablePreview;
    readonly resourceId?: string;
    readonly downloadName: string;
    readonly altText?: string;
}
export declare class WorkspaceDeliverableError extends Error {
    constructor(message: string);
}
/** Return a single safe basename suitable for Content-Disposition. */
export declare function safeDownloadName(pathInput: string, mediaType?: string): string;
/** Build bounded metadata without copying preview bytes into the envelope. */
export declare function createWorkspaceDeliverable(descriptor: PreviewDescriptor, source: WorkspaceDeliverableSource, sizeBytes: number): WorkspaceDeliverable;
export declare function deliverableResourceId(descriptor: PreviewDescriptor): string | undefined;
