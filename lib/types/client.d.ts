import { applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, createWorkspaceDrawerController, type WorkspaceConversationEventRegistry, type WorkspaceConversationContributionOptions, type WorkspaceSlotRegistry, workspaceConversationDefinition, workspaceConversationView } from "./web/workspace-conversation.ts";
import type { TypertClientRemote } from "@deepseek-ai/dsh-typert-protocol";
import { type WorkspacePreviewRenderOptions } from "./web/workspace-preview-adapters.ts";
import type { PreviewDescriptor } from "./domain/preview.ts";
interface ClientContributionContext {
    readonly conversationEvents: WorkspaceConversationEventRegistry;
    readonly slots: WorkspaceSlotRegistry;
    readonly effect: (factory: () => void | (() => void), label?: string) => void;
    readonly remote: TypertClientRemote;
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
export declare const inject: readonly ["conversationEvents", "slots", "remote"];
export declare function apply(ctx: ClientContributionContext): Promise<() => Promise<void>>;
export { applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, createWorkspaceDrawerController, workspaceConversationDefinition, workspaceConversationView, };
export type { WorkspaceConversationContributionOptions };
export { createWorkspacePreviewRenderer, sanitizeWorkspaceMarkdown } from "./web/workspace-preview-adapters.ts";
export type { WorkspacePreviewRenderOptions, WorkspacePrimitiveSet } from "./web/workspace-preview-adapters.ts";
export { buildWorkspaceResourceUrl, createWorkspaceArtifactDetail, createWorkspaceArtifactView, createWorkspaceDownloadController, normalizeWorkspaceArtifacts, } from "./web/workspace-deliverables.ts";
export type { WorkspaceArtifactDetail, WorkspaceArtifactDetailStatus, WorkspaceArtifactView, WorkspaceDeliverable, WorkspaceDeliverablePreview, WorkspaceDeliverableSource, WorkspaceDownloadResult, WorkspaceDownloadRuntime, WorkspaceDownloadStatus, WorkspaceFetchResponse, } from "./web/workspace-deliverables.ts";
