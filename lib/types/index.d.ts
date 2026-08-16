import { TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, PinnedContextRemoteSnapshot, WorkspaceArtifactPreview, WorkspaceDeliverable } from "./types.ts";
import { WorkspaceMemoryDomain, type MemoryScopeRequest } from "./domain/memory.ts";
import type { MemoryGovernanceAction } from "./domain/memory-governance.ts";
import { type MemoryDraft, type MemoryListOptions, type MemoryReadState, type MemoryRecord, type MemorySearchOptions } from "./domain/memory-store.ts";
export { MEMORY_MAX_CONTENT_BYTES, MEMORY_MAX_FILE_BYTES, MEMORY_MAX_QUERY_BYTES, MEMORY_MAX_RESULTS, MEMORY_MAX_TAGS, MEMORY_MAX_TAG_BYTES, MEMORY_MAX_TITLE_BYTES, MEMORY_SCHEMA_VERSION, memoryStorePath, MemoryStore, MemoryStoreError, type MemoryDraft, type MemoryListOptions, type MemoryMigration, type MemoryConfidence, type MemoryGovernance, type MemoryOrigin, type MemoryRetention, type MemorySourceRef, type MemoryVerification, type MemoryProvenance, type MemoryReadState, type MemoryRecord, type MemoryScope, type MemorySearchOptions, type MemoryStatus, type MemoryStoreErrorCode, type MemoryStoreLocationOptions, type MemoryStoreOptions, type MemoryStoreWarning, type MemoryType, type MemoryContentHash, } from "./domain/memory-store.ts";
export { WorkspaceMemoryDomain, workspaceMemoryContextFor, type MemoryHostAgent, type MemoryScopeRequest, type MemoryWorkspaceContext } from "./domain/memory.ts";
export { assertMemoryRevision, conflictGroupFor, exportMemoryBundle, importMemoryBundle, memoryGovernance, memoryGovernanceEligible, MemoryGovernanceError, sourceRef, transitionMemoryGovernance, } from "./domain/memory-governance.ts";
export { createPinnedContext, pinContextPath, setContextCapacity, updateContextPath } from "./domain/context.ts";
export { MEMORY_TYPES } from "./types.ts";
export { registerPinnedContextCarrier } from "./domain/context-carrier.ts";
export { PreviewPanelError, PreviewService, type BinaryPreviewDescriptor, type BoundedTextRead, type CsvPreviewDescriptor, type JsonPreviewDescriptor, type MarkdownPreviewDescriptor, type OpenedResource, type PreviewDescriptor, type PreviewErrorCode, type PreviewErrorDescriptor, type PreviewLimits, type ResourceRequest, type TextPreviewDescriptor, type UnsupportedPreviewDescriptor, } from "./domain/preview.ts";
export { createWorkspaceDeliverable, deliverableResourceId, safeDownloadName, WorkspaceDeliverableError, type WorkspaceDeliverable, type WorkspaceDeliverableOptions, type WorkspaceDeliverablePreview, type WorkspaceDeliverableSource, } from "./domain/deliverable.ts";
export { installWorkspaceResourceRoute, registerWorkspaceResourceRoute, type WebRouteRegistrar, type WorkspaceEffectRegistrar, type WorkspaceResourceRouteOptions, } from "./host/workspace-resource.ts";
export { WorkspaceArtifactCarrier, sessionToolRecords, type WorkspaceArtifactCarrierOptions, type WorkspaceArtifactPreview, type SessionEventLike, } from "./host/workspace-artifacts.ts";
export { createMemoryProposeTool, proposeMemory, registerMemoryPropose, MEMORY_PROPOSE_SECTION, MEMORY_PROPOSE_TOOL_NAME, type MemoryProposeArgs, } from "./host/workspace-memory-propose.ts";
export { attachWorkspaceSummaryEmitter, workspaceSummaryFor, type SummaryAgent, type WorkspaceSummaryData, } from "./host/workspace-summary.ts";
declare module "@deepseek-ai/dsh-typert-protocol" {
    interface TypertContextMap {
        agent: TypertContext<AgentId>;
    }
}
export interface WorkspaceServiceConfig {
    readonly memoryDomain?: WorkspaceMemoryDomain;
}
export declare class WorkspaceService extends TypertRemoteService {
    static inject: readonly ["agents"];
    private snapshot;
    private readonly memoryDomain;
    private readonly memoryWorkspaceSnapshots;
    private artifactCarrier?;
    private artifactAgentId?;
    private artifactRouteDispose?;
    constructor(ctx: Context, config?: WorkspaceServiceConfig);
    summary(agent: AgentId): {
        readonly ready: boolean;
        readonly agent: AgentId;
    };
    focus(agentId: AgentId): {
        readonly focused: boolean;
    };
    contextSnapshot(agentId: AgentId): PinnedContextRemoteSnapshot;
    replaceContext(agentId: AgentId, snapshot: PinnedContextRemoteSnapshot): PinnedContextRemoteSnapshot;
    artifactMetadata(agentId: AgentId): Promise<readonly WorkspaceDeliverable[]>;
    previewArtifact(agentId: AgentId, id: string): Promise<WorkspaceArtifactPreview>;
    memoryOpen(agentId: AgentId, request: MemoryScopeRequest): Promise<MemoryReadState>;
    memoryList(agentId: AgentId, request: MemoryScopeRequest, options?: MemoryListOptions): Promise<readonly MemoryRecord[]>;
    memoryUpsert(agentId: AgentId, request: MemoryScopeRequest, draft: MemoryDraft): Promise<MemoryRecord>;
    memoryArchive(agentId: AgentId, request: MemoryScopeRequest, id: string, expectedRevision: number, expectedHash: string): Promise<MemoryRecord>;
    memoryForget(agentId: AgentId, request: MemoryScopeRequest, id: string, expectedRevision: number, expectedHash: string): Promise<MemoryRecord>;
    memorySearch(agentId: AgentId, request: MemoryScopeRequest, query: string, options?: MemorySearchOptions): Promise<readonly MemoryRecord[]>;
    memoryMarkUsed(agentId: AgentId, request: MemoryScopeRequest, id: string): Promise<MemoryRecord>;
    memoryGovern(agentId: AgentId, request: MemoryScopeRequest, id: string, action: MemoryGovernanceAction, expectedRevision: number, expectedHash: string): Promise<MemoryRecord>;
    memoryExport(agentId: AgentId, request: MemoryScopeRequest): Promise<string>;
    memoryImport(agentId: AgentId, request: MemoryScopeRequest, serialized: string): Promise<readonly MemoryRecord[]>;
    memoryClose(agentId: AgentId, request: MemoryScopeRequest): Promise<void>;
    private agent;
    private memoryContext;
    private carrier;
}
export declare const name = "dsh-workspace-plugin";
export declare const inject: readonly ["tools", "systemPrompt"];
export declare function apply(ctx: Context): void;
