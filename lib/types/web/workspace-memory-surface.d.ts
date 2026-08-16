import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { MemoryDraft, MemoryListOptions, MemoryReadState, MemoryRecord, MemorySearchOptions, MemoryScopeRequest, MemoryType } from "../types.ts";
export declare const WORKSPACE_MEMORY_OVERLAY_SLOT: "shell.overlay";
export declare const WORKSPACE_MEMORY_ENTRY_KEY: "dsh-workspace-memory";
export interface WorkspaceMemoryRemote {
    readonly memoryOpen: (request: MemoryScopeRequest) => Promise<RemoteResult<MemoryReadState>>;
    readonly memoryList: (request: MemoryScopeRequest, options?: MemoryListOptions) => Promise<RemoteResult<readonly MemoryRecord[]>>;
    readonly memorySearch: (request: MemoryScopeRequest, query: string, options?: MemorySearchOptions) => Promise<RemoteResult<readonly MemoryRecord[]>>;
    readonly memoryUpsert: (request: MemoryScopeRequest, draft: MemoryDraft) => Promise<RemoteResult<MemoryRecord>>;
    readonly memoryArchive: (request: MemoryScopeRequest, id: string) => Promise<RemoteResult<MemoryRecord>>;
    readonly memoryForget: (request: MemoryScopeRequest, id: string) => Promise<RemoteResult<MemoryRecord>>;
}
export interface WorkspaceMemorySurfaceOptions {
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceMemoryRemote | undefined;
    readonly remote?: WorkspaceMemoryRemote;
}
export declare const workspaceMemoryTypes: readonly MemoryType[];
export declare function workspaceMemoryRequest(scope: MemoryScopeRequest["scope"], userId: string, sharedProject?: boolean): MemoryScopeRequest;
export declare function workspaceMemoryRecordSummary(record: MemoryRecord): string;
/** Review-only Memory surface. It never calls Agent, followup, or prompt/context APIs. */
export declare function createWorkspaceMemorySurfaceComponent(options?: WorkspaceMemorySurfaceOptions): (props: Record<string, unknown>) => ReactNode;
