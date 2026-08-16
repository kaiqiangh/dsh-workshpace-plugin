import { type MemoryDraft, type MemoryListOptions, type MemoryReadState, type MemoryRecord, type MemoryScope, type MemorySearchOptions } from "./memory-store.ts";
import { type MemoryGovernanceAction } from "./memory-governance.ts";
import type { WorkspaceIdentity } from "./workspace.ts";
export interface MemoryScopeRequest {
    readonly scope: MemoryScope;
    /** Required for User scope; never interpreted as a filesystem path. */
    readonly userId?: string;
    /** Shared Project is opt-in and must be explicitly true. */
    readonly sharedProject?: boolean;
    /** Required for every Shared Project write; read-only operations may omit it. */
    readonly sharedWriteAcknowledged?: boolean;
}
export interface MemoryWorkspaceContext {
    readonly identity: WorkspaceIdentity;
    readonly root?: string;
}
export declare class WorkspaceMemoryDomain {
    private readonly stores;
    private readonly dshHome;
    constructor(dshHome?: string);
    open(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<MemoryReadState>;
    list(context: MemoryWorkspaceContext, request: MemoryScopeRequest, options?: MemoryListOptions): Promise<readonly MemoryRecord[]>;
    upsert(context: MemoryWorkspaceContext, request: MemoryScopeRequest, draft: MemoryDraft): Promise<MemoryRecord>;
    archive(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string): Promise<MemoryRecord>;
    forget(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string): Promise<MemoryRecord>;
    search(context: MemoryWorkspaceContext, request: MemoryScopeRequest, query: string, options?: MemorySearchOptions): Promise<readonly MemoryRecord[]>;
    markUsed(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string): Promise<MemoryRecord>;
    govern(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string, action: MemoryGovernanceAction, expectedRevision: number, expectedHash: string): Promise<MemoryRecord>;
    export(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<string>;
    import(context: MemoryWorkspaceContext, request: MemoryScopeRequest, serialized: string): Promise<readonly MemoryRecord[]>;
    close(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<void>;
    dispose(): Promise<void>;
    private withConflictGroups;
    private store;
}
