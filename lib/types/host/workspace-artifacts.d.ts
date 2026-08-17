import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import { PreviewService } from "../domain/preview.ts";
import { type NativeDurableToolRecord } from "../domain/observation.ts";
import { type WorkspaceIdentity, type WorkspaceSnapshot } from "../domain/workspace.ts";
export interface WorkspaceArtifactTextPreview {
    readonly type: "text";
    readonly renderer: "ui-primitives";
    readonly language?: string;
    readonly content: string;
    readonly truncated: boolean;
}
export interface WorkspaceArtifactMarkdownPreview {
    readonly type: "markdown";
    readonly renderer: "ui-primitives";
    readonly content: string;
    readonly truncated: boolean;
    readonly policy: {
        readonly allowRawHtml: false;
        readonly allowRemoteImages: false;
        readonly allowedLinkSchemes: readonly ["http", "https", "mailto"];
    };
    /**
     * Same-origin opaque resource URLs for the markdown's relative images,
     * keyed by the raw src (e.g. "./img.png" -> "/workspace/resource?id=..").
     * Images whose relative path escaped the root, or that failed to resolve,
     * are absent — the renderer then drops them (alt text only). A plain
     * object so it crosses the Typert remote boundary (no Map/symbol keys).
     */
    readonly imageUrls?: Readonly<Record<string, string>>;
}
export interface WorkspaceArtifactJsonPreview {
    readonly type: "json";
    readonly renderer: "ui-primitives";
    readonly value: WorkspaceJsonValue;
}
export type WorkspaceJsonValue = null | boolean | number | string | readonly WorkspaceJsonValue[] | {
    readonly [key: string]: WorkspaceJsonValue;
};
export interface WorkspaceArtifactCsvPreview {
    readonly type: "csv";
    readonly renderer: "ui-primitives";
    readonly columns: readonly string[];
    readonly rows: readonly (readonly string[])[];
    readonly truncated: boolean;
}
export interface WorkspaceArtifactBinaryPreview {
    readonly type: "binary";
    readonly mediaType: string;
    readonly resourceId: string;
    readonly version: string;
    readonly expiresAt: number;
}
export interface WorkspaceArtifactUnsupportedPreview {
    readonly type: "unsupported";
    readonly reason: string;
    readonly mediaType?: string;
    readonly size?: number;
}
export interface WorkspaceArtifactErrorPreview {
    readonly type: "error";
    readonly code: string;
    readonly message: string;
}
export type WorkspaceArtifactPreview = WorkspaceArtifactTextPreview | WorkspaceArtifactMarkdownPreview | WorkspaceArtifactJsonPreview | WorkspaceArtifactCsvPreview | WorkspaceArtifactBinaryPreview | WorkspaceArtifactUnsupportedPreview | WorkspaceArtifactErrorPreview;
export interface WorkspaceArtifactCarrierOptions {
    readonly workspace: WorkspaceSnapshot;
    readonly root: string;
    readonly records: () => readonly NativeDurableToolRecord[];
    readonly preview?: PreviewService;
}
export interface SessionEventLike {
    readonly seq: number;
    readonly time?: number;
    readonly type: string;
    readonly data?: Record<string, unknown>;
}
/**
 * Session-scoped artifact carrier. It derives each snapshot from durable tool
 * records and keeps PreviewService as the only byte/resource authority.
 */
export declare class WorkspaceArtifactCarrier {
    readonly identity: WorkspaceIdentity;
    readonly preview: PreviewService;
    private readonly workspace;
    private readonly root;
    private readonly records;
    private artifacts;
    private readonly descriptorCache;
    constructor(options: WorkspaceArtifactCarrierOptions);
    metadata(): Promise<readonly WorkspaceDeliverable[]>;
    previewArtifact(id: string): Promise<WorkspaceArtifactPreview>;
    dispose(): void;
    private projection;
}
export declare function sessionToolRecords(events: readonly SessionEventLike[]): readonly NativeDurableToolRecord[];
