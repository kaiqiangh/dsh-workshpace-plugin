import {
  applyWorkspaceConversationContribution,
  createWorkspaceChatNodeComponent,
  createWorkspaceDrawerController,
  type WorkspaceConversationEventRegistry,
  type WorkspaceConversationContributionOptions,
  type WorkspaceSlotRegistry,
  workspaceConversationDefinition,
  workspaceConversationView,
} from "./web/workspace-conversation.ts";
import { createElement } from "react";
import { CodeBlock, JsonTree, MarkdownText } from "@deepseek-ai/dsh-client-ui-primitives";
import { TYPERT_REMOTE } from "./typert.remote-client.js";
import type { TypertClientRemote, TypertRemoteContribution, TypertDisposer } from "@deepseek-ai/dsh-typert-protocol";
import { createWorkspacePreviewRenderer, type WorkspacePreviewRenderOptions } from "./web/workspace-preview-adapters.ts";
import type { PreviewDescriptor } from "./domain/preview.ts";
import {
  createWorkspaceArtifactSurfaceComponent,
  WORKSPACE_ARTIFACT_ENTRY_KEY,
  WORKSPACE_ARTIFACT_OVERLAY_SLOT,
  WORKSPACE_ARTIFACT_SLOT_NAME,
  type WorkspaceArtifactRemote,
} from "./web/workspace-artifact-surface.ts";

interface ClientContributionContext {
  readonly conversationEvents: WorkspaceConversationEventRegistry;
  readonly slots: WorkspaceSlotRegistry;
  readonly effect: (factory: () => void | (() => void), label?: string) => void;
  readonly remote: TypertClientRemote;
  readonly sessions?: { readonly scope: (id: string) => { readonly remote: TypertClientRemote } | undefined };
  readonly emit: (event: string, ...args: readonly unknown[]) => void;
}

interface WorkspaceOverlaySlotRegistry {
  readonly inject: (key: string, callback: () => () => void) => () => void;
  readonly register: (options: { readonly name: string; readonly id: string; readonly order?: number; readonly label?: string; readonly priority?: number }, component: (props: Record<string, unknown>) => unknown) => () => void;
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

export const workspaceClient: WorkspaceClientSurface = Object.freeze({ ready: true });

export function renderWorkspacePreview(descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown {
  return createWorkspacePreviewRenderer({ MarkdownText, CodeBlock, JsonTree }, descriptor, options);
}

export const inject = ["conversationEvents", "slots", "remote", "sessions"] as const;

export async function apply(ctx: ClientContributionContext): Promise<() => Promise<void>> {
  if (!ctx?.conversationEvents || !ctx.slots || typeof ctx.effect !== "function" || !ctx.remote?.$mount || typeof ctx.emit !== "function") {
    throw new Error("DSH Workspace requires the public conversation and Typert Remote seams");
  }
  const remoteDispose: TypertDisposer = await ctx.remote.$mount(TYPERT_REMOTE as TypertRemoteContribution);
  let disposeConversation: (() => void) | undefined;
  try {
    ctx.effect(() => {
      const disposeEvent = ctx.conversationEvents.register(workspaceConversationDefinition);
      const disposeSlot = ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
        { name: "conversation.chat.node", key: "dsh-workspace-summary" },
        createWorkspaceChatNodeComponent(
          (model) => createElement(
            "section",
            { "data-dsh-workspace": "summary" },
            createElement("strong", null, model.summary.workspaceName),
            createElement("span", null, ` ${model.summary.filesTouched} files, ${model.summary.changes} changes`),
            createElement("button", { type: "button", onClick: model.openWorkspace.action }, model.openWorkspace.label),
          ),
          () => ctx.emit("workspace/open"),
        ),
      ));
      let disposed = false;
      let disposeOverlay = () => {};
      const overlay = ctx.slots as unknown as WorkspaceOverlaySlotRegistry;
      if (typeof overlay.inject === "function" && typeof overlay.register === "function") {
        disposeOverlay = overlay.inject(WORKSPACE_ARTIFACT_OVERLAY_SLOT, () => overlay.register(
          { name: WORKSPACE_ARTIFACT_SLOT_NAME, id: WORKSPACE_ARTIFACT_ENTRY_KEY, order: 0 },
          createWorkspaceArtifactSurfaceComponent(undefined, { MarkdownText, CodeBlock, JsonTree }, {
            resolveRemote: (sessionId) => {
              const scoped = sessionId ? ctx.sessions?.scope(sessionId) : undefined;
              return (scoped?.remote as unknown as { readonly workspace?: WorkspaceArtifactRemote } | undefined)?.workspace;
            },
          }),
        ));
      }
      disposeConversation = () => {
        if (disposed) return;
        disposed = true;
        disposeOverlay();
        disposeSlot();
        disposeEvent();
      };
      return disposeConversation;
    }, "dsh Workspace client contribution");
  } catch (error) {
    await remoteDispose();
    throw error;
  }
  return async () => {
    const dispose = disposeConversation;
    disposeConversation = undefined;
    dispose?.();
    await remoteDispose();
  };
}

export {
  applyWorkspaceConversationContribution,
  createWorkspaceChatNodeComponent,
  createWorkspaceDrawerController,
  workspaceConversationDefinition,
  workspaceConversationView,
};

export type { WorkspaceConversationContributionOptions };
export { createWorkspacePreviewRenderer, sanitizeWorkspaceMarkdown } from "./web/workspace-preview-adapters.ts";
export type { WorkspacePreviewRenderOptions, WorkspacePrimitiveSet } from "./web/workspace-preview-adapters.ts";
export {
  buildWorkspaceResourceUrl,
  createWorkspaceArtifactDetail,
  createWorkspaceArtifactView,
  createWorkspaceDownloadController,
  normalizeWorkspaceArtifacts,
} from "./web/workspace-deliverables.ts";
export {
  createWorkspaceArtifactSurfaceComponent,
  workspaceArtifactPreviewDescriptor,
  workspaceArtifactResourceUrl,
  WORKSPACE_ARTIFACT_ENTRY_KEY,
  WORKSPACE_ARTIFACT_OVERLAY_SLOT,
  WORKSPACE_ARTIFACT_SLOT_NAME,
} from "./web/workspace-artifact-surface.ts";
export type {
  WorkspaceArtifactDetail,
  WorkspaceArtifactDetailStatus,
  WorkspaceArtifactView,
  WorkspaceDeliverable,
  WorkspaceDeliverablePreview,
  WorkspaceDeliverableSource,
  WorkspaceDownloadResult,
  WorkspaceDownloadRuntime,
  WorkspaceDownloadStatus,
  WorkspaceFetchResponse,
} from "./web/workspace-deliverables.ts";
export type { WorkspaceArtifactRemote, WorkspaceArtifactSurfaceOptions } from "./web/workspace-artifact-surface.ts";
