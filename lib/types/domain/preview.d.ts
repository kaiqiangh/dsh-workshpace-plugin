import { type WorkspaceIdentity, type WorkspacePath } from "./workspace.ts";
export interface PreviewLimits {
    readonly maxTextBytes: number;
    readonly maxJsonBytes: number;
    readonly maxCsvBytes: number;
    readonly maxCsvRows: number;
    readonly maxImageBytes: number;
    readonly maxPdfBytes: number;
}
export type PreviewErrorCode = "PATH_OUTSIDE_WORKSPACE" | "SYMLINK_ESCAPE" | "FILE_NOT_FOUND" | "PERMISSION_DENIED" | "FILE_TOO_LARGE" | "INVALID_JSON" | "INVALID_CSV" | "RESOURCE_INVALID" | "RESOURCE_EXPIRED" | "RESOURCE_STALE" | "RESOURCE_UNAUTHORIZED" | "UNSUPPORTED_PREVIEW" | "PROVIDER_UNAVAILABLE";
export declare class PreviewPanelError extends Error {
    readonly code: PreviewErrorCode;
    constructor(code: PreviewErrorCode, message?: string);
}
export interface PreviewErrorDescriptor {
    readonly type: "error";
    readonly code: PreviewErrorCode;
    readonly message: string;
}
export interface TextPreviewDescriptor {
    readonly type: "text";
    readonly path: WorkspacePath;
    readonly renderer: "ui-primitives";
    readonly language?: string;
    readonly content: string;
    readonly truncated: boolean;
}
export interface MarkdownPreviewDescriptor {
    readonly type: "markdown";
    readonly path: WorkspacePath;
    readonly renderer: "ui-primitives";
    readonly content: string;
    readonly truncated: boolean;
    readonly policy: {
        readonly allowRawHtml: false;
        readonly allowRemoteImages: false;
        readonly allowedLinkSchemes: readonly ["http", "https", "mailto"];
    };
}
export interface JsonPreviewDescriptor {
    readonly type: "json";
    readonly path: WorkspacePath;
    readonly renderer: "ui-primitives";
    readonly value: unknown;
}
export interface CsvPreviewDescriptor {
    readonly type: "csv";
    readonly path: WorkspacePath;
    readonly renderer: "ui-primitives";
    readonly columns: readonly string[];
    readonly rows: readonly (readonly string[])[];
    readonly truncated: boolean;
}
export interface BinaryPreviewDescriptor {
    readonly type: "binary";
    readonly path: WorkspacePath;
    readonly mediaType: string;
    readonly resourceId: string;
    readonly version: string;
    readonly expiresAt: number;
}
export interface UnsupportedPreviewDescriptor {
    readonly type: "unsupported";
    readonly path: WorkspacePath;
    readonly reason: string;
    readonly mediaType?: string;
    readonly size?: number;
}
export type PreviewDescriptor = TextPreviewDescriptor | MarkdownPreviewDescriptor | JsonPreviewDescriptor | CsvPreviewDescriptor | BinaryPreviewDescriptor | UnsupportedPreviewDescriptor | PreviewErrorDescriptor;
export interface ResourceRequest {
    readonly identity: WorkspaceIdentity;
    readonly mediaType?: string;
    readonly signal?: AbortSignal;
}
export interface OpenedResource {
    readonly mediaType: string;
    readonly version: string;
    readonly downloadName: string;
    readonly bytes: Uint8Array;
}
export interface BoundedTextRead {
    readonly path: WorkspacePath;
    readonly content: string;
    readonly bytes: number;
    readonly version: string;
    readonly loadedAt: number;
}
export declare class PreviewService {
    private readonly root;
    readonly identity: WorkspaceIdentity;
    private readonly limits;
    private readonly resourceTtlMs;
    private readonly now;
    private readonly resources;
    private disposed;
    constructor(root: string, identity: WorkspaceIdentity, options?: {
        readonly limits?: Partial<PreviewLimits>;
        readonly resourceTtlMs?: number;
        readonly now?: () => number;
    });
    preview(pathInput: string): Promise<PreviewDescriptor>;
    /** Read one bounded text file with canonical containment and before/after version checks. */
    readText(pathInput: string, maxBytes: number, signal?: AbortSignal): Promise<BoundedTextRead>;
    openResource(resourceId: string, request: ResourceRequest): Promise<OpenedResource>;
    dispose(): void;
    private resolve;
    private binary;
    private json;
    private csv;
}
