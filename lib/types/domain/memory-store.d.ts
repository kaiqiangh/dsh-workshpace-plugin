export declare const MEMORY_SCHEMA_VERSION: 1;
export declare const MEMORY_MAX_TITLE_BYTES = 256;
export declare const MEMORY_MAX_CONTENT_BYTES: number;
export declare const MEMORY_MAX_TAGS = 32;
export declare const MEMORY_MAX_TAG_BYTES = 64;
export declare const MEMORY_MAX_QUERY_BYTES = 256;
export declare const MEMORY_MAX_RESULTS = 100;
export declare const MEMORY_MAX_FILE_BYTES: number;
export type MemoryScope = "session" | "project" | "user" | "shared-project";
export type MemoryType = "decision" | "preference" | "convention" | "fact";
export type MemoryStatus = "active" | "archived" | "forgotten";
export type MemoryProvenanceKind = "user" | "agent" | "tool" | "import";
export type MemoryOrigin = "user-authored" | "imported" | "derived" | "model-suggested";
export type MemoryVerification = "unverified" | "verified" | "rejected" | "stale";
export type MemoryConfidence = "low" | "medium" | "high";
export type MemoryRetention = "session-end" | "project-delete" | "user-managed";
export type MemoryContentHash = string;
export interface MemorySourceRef {
    readonly kind: "session" | "event" | "file" | "url" | "import";
    readonly id: string;
    readonly contentHash?: MemoryContentHash;
}
export interface MemoryGovernance {
    readonly origin: MemoryOrigin;
    readonly sourceRefs: readonly MemorySourceRef[];
    readonly verification: MemoryVerification;
    readonly verifiedAt?: number;
    readonly verifiedBy?: "user" | "trusted-tool";
    readonly confidence?: MemoryConfidence;
    readonly revision: number;
    readonly conflictGroup?: string;
    readonly pinnedAt?: number;
    readonly pinnedBy?: "user";
    readonly expiresAt?: number;
    readonly retention: MemoryRetention;
}
export interface MemoryProvenance {
    readonly kind: MemoryProvenanceKind;
    readonly sessionId?: string;
    readonly eventSeq?: number;
    readonly note?: string;
}
export interface MemoryRecord {
    readonly schemaVersion: typeof MEMORY_SCHEMA_VERSION;
    readonly id: string;
    readonly scope: MemoryScope;
    readonly scopeKey: string;
    readonly type: MemoryType;
    readonly title: string;
    readonly content: string;
    readonly tags: readonly string[];
    readonly provenance: MemoryProvenance;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly lastUsedAt?: number;
    readonly useCount: number;
    readonly contentHash: MemoryContentHash;
    readonly status: MemoryStatus;
    readonly governance?: MemoryGovernance;
}
export type MemoryDraft = Pick<MemoryRecord, "scope" | "scopeKey" | "type" | "title" | "content" | "tags" | "provenance"> & {
    readonly id?: string;
    readonly createdAt?: number;
    readonly updatedAt?: number;
    readonly lastUsedAt?: number;
    readonly useCount?: number;
    readonly status?: MemoryStatus;
    readonly governance?: MemoryGovernance;
    readonly expectedRevision?: number;
    readonly expectedHash?: string;
};
export interface MemoryStoreLocationOptions {
    readonly scope: MemoryScope;
    readonly scopeKey: string;
    readonly projectRoot?: string;
    readonly dshHome?: string;
}
export interface MemoryStoreOptions extends MemoryStoreLocationOptions {
    readonly filePath?: string;
    readonly now?: () => number;
    readonly idFactory?: () => string;
    readonly maxContentBytes?: number;
    readonly migrations?: readonly MemoryMigration[];
}
export interface MemoryMigration {
    readonly from: number;
    readonly to: number;
    readonly migrate: (record: Record<string, unknown>) => Record<string, unknown>;
}
export interface MemoryStoreWarning {
    readonly code: "CORRUPT_RECORD" | "BAD_HASH" | "UNSUPPORTED_SCHEMA" | "TRUNCATED_LINE" | "STORE_TOO_LARGE";
    readonly line: number;
    readonly message: string;
}
export interface MemoryReadState {
    readonly scope: MemoryScope;
    readonly scopeKey: string;
    readonly records: readonly MemoryRecord[];
    readonly warnings: readonly MemoryStoreWarning[];
    readonly readOnly: boolean;
}
export interface MemoryListOptions {
    readonly type?: MemoryType;
    readonly status?: MemoryStatus;
    readonly limit?: number;
}
export interface MemorySearchOptions extends MemoryListOptions {
    readonly limit?: number;
}
export type MemoryStoreErrorCode = "INVALID_RECORD" | "SCOPE_MISMATCH" | "PROJECT_UNAVAILABLE" | "STORE_UNAVAILABLE" | "STORE_CLOSED" | "SAVE_FAILURE" | "UNSUPPORTED_SCHEMA";
export declare class MemoryStoreError extends Error {
    readonly code: MemoryStoreErrorCode;
    constructor(code: MemoryStoreErrorCode, message: string);
}
export declare function memoryStorePath(options: MemoryStoreLocationOptions): string;
export declare class MemoryStore {
    readonly filePath: string;
    readonly scope: MemoryScope;
    readonly scopeKey: string;
    private readonly now;
    private readonly idFactory;
    private readonly maxContentBytes;
    private readonly projectRoot?;
    private readonly migrations;
    private records;
    private foreignLines;
    private warnings;
    private readOnly;
    private opened;
    private ensureSafePath;
    constructor(options: MemoryStoreOptions);
    open(): Promise<MemoryReadState>;
    state(): MemoryReadState;
    list(options?: MemoryListOptions): readonly MemoryRecord[];
    upsert(draft: MemoryDraft): Promise<MemoryRecord>;
    archive(id: string): Promise<MemoryRecord>;
    forget(id: string): Promise<MemoryRecord>;
    markUsed(id: string): Promise<MemoryRecord>;
    search(query: string, options?: MemorySearchOptions): readonly MemoryRecord[];
    compact(): Promise<void>;
    close(): Promise<void>;
    private tombstone;
    private require;
    private ensureOpen;
    private ensureWritable;
    private append;
    private reloadLatest;
    private withLock;
    private quarantine;
}
