import { applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, type WorkspaceConversationEventRegistry, type WorkspaceConversationContributionOptions, type WorkspaceSlotRegistry, workspaceConversationDefinition, workspaceConversationView } from "./web/workspace-conversation.ts";
import type { TypertClientRemote } from "@deepseek-ai/dsh-typert-protocol";
import { type WorkspacePreviewRenderOptions } from "./web/workspace-preview-adapters.ts";
import type { PreviewDescriptor } from "./domain/preview.ts";
interface ClientContributionContext {
    readonly conversationEvents: WorkspaceConversationEventRegistry;
    readonly slots: WorkspaceSlotRegistry;
    readonly effect: (factory: () => void | (() => void), label?: string) => void;
    readonly inject?: (dependencies: readonly string[], callback: (scope: ClientContributionContext) => void | (() => void)) => {
        readonly dispose: () => Promise<void>;
    };
    readonly remote: TypertClientRemote;
    readonly sessions?: {
        readonly scope: (id: string) => {
            readonly get?: (key: string) => unknown;
            readonly remote?: TypertClientRemote;
        } | undefined;
    };
    readonly emit: (event: string, ...args: readonly unknown[]) => void;
}
declare module "@deepseek-ai/cordis" {
    interface Events {
        "workspace/open"(): void;
    }
}
/** @typert object */
export interface WorkspaceClientSurface {
    readonly ready: boolean;
}
export declare const workspaceClient: WorkspaceClientSurface;
export declare function renderWorkspacePreview(descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown;
export declare const inject: readonly ["slots", "remote"];
export declare function apply(ctx: ClientContributionContext): Promise<() => Promise<void>>;
export { applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, workspaceConversationDefinition, workspaceConversationView, };
export type { WorkspaceConversationContributionOptions };
export { createWorkspacePreviewRenderer, sanitizeWorkspaceMarkdown } from "./web/workspace-preview-adapters.ts";
export type { WorkspacePreviewRenderOptions, WorkspacePrimitiveSet } from "./web/workspace-preview-adapters.ts";
export { buildWorkspaceResourceUrl, createWorkspaceArtifactDetail, createWorkspaceArtifactView, createWorkspaceDownloadController, normalizeWorkspaceArtifacts, } from "./web/workspace-deliverables.ts";
export { createWorkspaceArtifactSurfaceComponent, workspaceArtifactPreviewDescriptor, workspaceArtifactResourceUrl, WORKSPACE_ARTIFACT_SLOT_NAME, } from "./web/workspace-artifact-surface.ts";
export type { WorkspaceArtifactDetail, WorkspaceArtifactDetailStatus, WorkspaceArtifactView, WorkspaceDeliverable, WorkspaceDeliverablePreview, WorkspaceDeliverableSource, WorkspaceDownloadResult, WorkspaceDownloadRuntime, WorkspaceDownloadStatus, WorkspaceFetchResponse, } from "./web/workspace-deliverables.ts";
export type { WorkspaceArtifactRemote, WorkspaceArtifactSurfaceOptions } from "./web/workspace-artifact-surface.ts";
export { createWorkspaceMemorySurfaceComponent, workspaceMemoryRecordSummary, workspaceMemoryRequest, workspaceMemoryTypes, } from "./web/workspace-memory-surface.ts";
export type { WorkspaceMemoryRemote, WorkspaceMemorySurfaceOptions } from "./web/workspace-memory-surface.ts";
export { createWorkspaceChangesSurfaceComponent, } from "./web/workspace-changes-surface.ts";
export type { WorkspaceChangesRemote, WorkspaceChangesSurfaceOptions } from "./web/workspace-changes-surface.ts";
export { createWorkspaceGitSurfaceComponent, } from "./web/workspace-git-surface.ts";
export type { WorkspaceGitPrimitives, WorkspaceGitRemote, WorkspaceGitSurfaceOptions } from "./web/workspace-git-surface.ts";
export { createWorkspaceHistorySurfaceComponent, } from "./web/workspace-history-surface.ts";
export type { WorkspaceHistoryRemote, WorkspaceHistorySurfaceOptions } from "./web/workspace-history-surface.ts";
export { installWorkspaceStyles } from "./web/workspace-styles.ts";
export type { WorkspaceSurfaceComponent } from "./web/workspace-styles.ts";
export { createWorkspaceConversationViewComponent, workspaceConversationViewRegistration, WORKSPACE_VIEW_ENTRY_KEY, WORKSPACE_VIEW_LABEL, WORKSPACE_VIEW_ORDER, WORKSPACE_VIEW_SLOT, } from "./web/workspace-view.ts";
export type { WorkspaceConversationViewOptions, WorkspaceConversationViewRegistration, WorkspaceViewSlotRegistry } from "./web/workspace-view.ts";
