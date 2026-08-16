import { TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, PinnedContextRemoteSnapshot, WorkspaceArtifactPreview, WorkspaceDeliverable } from "./types.ts";
export { MEMORY_MAX_CONTENT_BYTES, MEMORY_MAX_QUERY_BYTES, MEMORY_MAX_RESULTS, MEMORY_MAX_TAGS, MEMORY_MAX_TAG_BYTES, MEMORY_MAX_TITLE_BYTES, MEMORY_SCHEMA_VERSION, memoryStorePath, MemoryStore, MemoryStoreError, type MemoryDraft, type MemoryListOptions, type MemoryProvenance, type MemoryReadState, type MemoryRecord, type MemoryScope, type MemorySearchOptions, type MemoryStatus, type MemoryStoreErrorCode, type MemoryStoreLocationOptions, type MemoryStoreOptions, type MemoryStoreWarning, type MemoryType, } from "./domain/memory-store.ts";
export { createPinnedContext, pinContextPath, setContextCapacity, updateContextPath } from "./domain/context.ts";
export { registerPinnedContextCarrier } from "./domain/context-carrier.ts";
export { PreviewPanelError, PreviewService, type BinaryPreviewDescriptor, type BoundedTextRead, type CsvPreviewDescriptor, type JsonPreviewDescriptor, type MarkdownPreviewDescriptor, type OpenedResource, type PreviewDescriptor, type PreviewErrorCode, type PreviewErrorDescriptor, type PreviewLimits, type ResourceRequest, type TextPreviewDescriptor, type UnsupportedPreviewDescriptor, } from "./domain/preview.ts";
export { createWorkspaceDeliverable, deliverableResourceId, safeDownloadName, WorkspaceDeliverableError, type WorkspaceDeliverable, type WorkspaceDeliverableOptions, type WorkspaceDeliverablePreview, type WorkspaceDeliverableSource, } from "./domain/deliverable.ts";
export { installWorkspaceResourceRoute, registerWorkspaceResourceRoute, type WebRouteRegistrar, type WorkspaceEffectRegistrar, type WorkspaceResourceRouteOptions, } from "./host/workspace-resource.ts";
export { WorkspaceArtifactCarrier, sessionToolRecords, type WorkspaceArtifactCarrierOptions, type WorkspaceArtifactPreview, type SessionEventLike, } from "./host/workspace-artifacts.ts";
declare module "@deepseek-ai/dsh-typert-protocol" {
    interface TypertContextMap {
        agent: TypertContext<AgentId>;
    }
}
export declare class WorkspaceService extends TypertRemoteService {
    private snapshot;
    private artifactCarrier?;
    private artifactAgentId?;
    private artifactRouteDispose?;
    constructor(ctx: Context);
    summary(agent: AgentId): {
        readonly ready: boolean;
        readonly agent: AgentId;
    };
    focus(): {
        readonly focused: boolean;
    };
    contextSnapshot(): PinnedContextRemoteSnapshot;
    replaceContext(snapshot: PinnedContextRemoteSnapshot): PinnedContextRemoteSnapshot;
    artifactMetadata(): Promise<readonly WorkspaceDeliverable[]>;
    previewArtifact(id: string): Promise<WorkspaceArtifactPreview>;
    private carrier;
}
export declare const name = "dsh-workspace-plugin";
export declare function apply(ctx: Context): void;
