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
  type WorkspaceArtifactRemote,
} from "./web/workspace-artifact-surface.ts";
import {
  createWorkspaceMemorySurfaceComponent,
  type WorkspaceMemoryRemote,
} from "./web/workspace-memory-surface.ts";
import type { MemoryScopeRequest } from "./domain/memory.ts";
import {
  createWorkspacePanelComponent,
  installWorkspacePanelStyles,
  WORKSPACE_PANEL_ENTRY_KEY,
  WORKSPACE_PANEL_OVERLAY_SLOT,
} from "./web/workspace-panel.ts";
import {
  createWorkspaceConversationViewComponent,
  workspaceConversationViewRegistration,
  WORKSPACE_VIEW_SLOT,
  type WorkspaceViewSlotRegistry,
} from "./web/workspace-view.ts";

interface ClientContributionContext {
  readonly conversationEvents: WorkspaceConversationEventRegistry;
  readonly slots: WorkspaceSlotRegistry;
  readonly effect: (factory: () => void | (() => void), label?: string) => void;
  readonly inject?: (dependencies: readonly string[], callback: (scope: ClientContributionContext) => void | (() => void)) => { readonly dispose: () => Promise<void> };
  readonly remote: TypertClientRemote;
  readonly sessions?: { readonly scope: (id: string) => { readonly get?: (key: string) => unknown; readonly remote?: TypertClientRemote } | undefined };
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
  let openWorkspacePanel: (() => void) | undefined;
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
          () => { ctx.emit("workspace/open"); openWorkspacePanel?.(); },
        ),
      ));
      let disposed = false;
      let disposeSurfaces = () => {};
      const overlay = ctx.slots as unknown as WorkspaceOverlaySlotRegistry;
      const viewSlots = ctx.slots as unknown as WorkspaceViewSlotRegistry;
      const registerWorkspaceSurfaces = (scope: ClientContributionContext): (() => void) => {
        const workspace = (scope.remote as unknown as { readonly workspace?: Record<string, (...args: readonly unknown[]) => Promise<unknown>> }).workspace;
        const remotes = new Map<string, WorkspaceArtifactRemote & WorkspaceMemoryRemote>();
        const resolveRemote = (sessionId: string | undefined): WorkspaceArtifactRemote & WorkspaceMemoryRemote | undefined => {
          if (!sessionId || !workspace) return undefined;
          const cached = remotes.get(sessionId);
          if (cached) return cached;
          const call = <T>(method: string, ...args: readonly unknown[]): Promise<T> => workspace[method]!(sessionId, ...args) as Promise<T>;
          const adapted: WorkspaceArtifactRemote & WorkspaceMemoryRemote = {
            artifactMetadata: () => call("artifactMetadata"),
            previewArtifact: (id: Parameters<WorkspaceArtifactRemote["previewArtifact"]>[0]) => call("previewArtifact", id),
            memoryOpen: (request: Parameters<WorkspaceMemoryRemote["memoryOpen"]>[0]) => call("memoryOpen", request),
            memoryList: (request: Parameters<WorkspaceMemoryRemote["memoryList"]>[0], options: Parameters<WorkspaceMemoryRemote["memoryList"]>[1]) => call("memoryList", request, options),
            memorySearch: (request: Parameters<WorkspaceMemoryRemote["memorySearch"]>[0], query: Parameters<WorkspaceMemoryRemote["memorySearch"]>[1], options: Parameters<WorkspaceMemoryRemote["memorySearch"]>[2]) => call("memorySearch", request, query, options),
            memoryUpsert: (request: Parameters<WorkspaceMemoryRemote["memoryUpsert"]>[0], draft: Parameters<WorkspaceMemoryRemote["memoryUpsert"]>[1]) => call("memoryUpsert", request, draft),
            memoryArchive: (request: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[0], id: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[1], revision: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[2], hash: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[3]) => call("memoryArchive", request, id, revision, hash),
            memoryForget: (request: Parameters<WorkspaceMemoryRemote["memoryForget"]>[0], id: Parameters<WorkspaceMemoryRemote["memoryForget"]>[1], revision: Parameters<WorkspaceMemoryRemote["memoryForget"]>[2], hash: Parameters<WorkspaceMemoryRemote["memoryForget"]>[3]) => call("memoryForget", request, id, revision, hash),
            memoryGovern: (request: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[0], id: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[1], action: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[2], revision: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[3], hash: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[4]) => call("memoryGovern", request, id, action, revision, hash),
            memoryExport: (request: Parameters<WorkspaceMemoryRemote["memoryExport"]>[0]) => call("memoryExport", request),
            memoryImport: (request: Parameters<WorkspaceMemoryRemote["memoryImport"]>[0], serialized: Parameters<WorkspaceMemoryRemote["memoryImport"]>[1]) => call("memoryImport", request, serialized),
            memoryMarkUsed: (request: MemoryScopeRequest, id: string) => call("memoryMarkUsed", request, id),
            memoryClose: (request: MemoryScopeRequest) => call("memoryClose", request),
          };
          remotes.set(sessionId, adapted);
          return adapted;
        };
        const disposeStyles = installWorkspacePanelStyles();
        const disposers: (() => void)[] = [disposeStyles];
        const artifacts = createWorkspaceArtifactSurfaceComponent(undefined, { MarkdownText, CodeBlock, JsonTree }, {
          resolveRemote,
        });
        const memory = createWorkspaceMemorySurfaceComponent({
          resolveRemote,
        });
        if (typeof overlay.inject === "function" && typeof overlay.register === "function") {
          disposers.push(overlay.inject(WORKSPACE_PANEL_OVERLAY_SLOT, () => overlay.register(
            { name: WORKSPACE_PANEL_OVERLAY_SLOT, id: WORKSPACE_PANEL_ENTRY_KEY, label: "Workspace", order: 0, priority: 100 },
            createWorkspacePanelComponent({ artifacts, memory }),
          )));
        }
        if (typeof viewSlots.inject === "function" && typeof viewSlots.register === "function") {
          disposers.push(viewSlots.inject(WORKSPACE_VIEW_SLOT, () => viewSlots.register(
            workspaceConversationViewRegistration(),
            createWorkspaceConversationViewComponent({ artifacts, memory }),
          )));
        }
        openWorkspacePanel = () => {
          const panel = typeof document === "object" ? document.querySelector?.('[data-dsh-workspace="panel"]') : undefined;
          if (panel && typeof panel.setAttribute === "function") panel.setAttribute("open", "");
        };
        return () => {
          remotes.clear();
          openWorkspacePanel = undefined;
          for (const dispose of disposers.reverse()) dispose();
        };
      };
      let directWorkspace = false;
      try { directWorkspace = Boolean((ctx.remote as unknown as { readonly workspace?: unknown }).workspace); } catch {}
      if (directWorkspace) {
        disposeSurfaces = registerWorkspaceSurfaces(ctx);
      } else {
        const remoteScope = ctx.inject?.(["remote.workspace"], registerWorkspaceSurfaces);
        if (remoteScope) disposeSurfaces = () => { void remoteScope.dispose(); };
        else disposeSurfaces = registerWorkspaceSurfaces(ctx);
      }
      disposeConversation = () => {
        if (disposed) return;
        disposed = true;
        disposeSurfaces();
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
export {
  createWorkspaceMemorySurfaceComponent,
  workspaceMemoryRecordSummary,
  workspaceMemoryRequest,
  WORKSPACE_MEMORY_ENTRY_KEY,
  WORKSPACE_MEMORY_OVERLAY_SLOT,
  workspaceMemoryTypes,
} from "./web/workspace-memory-surface.ts";
export type { WorkspaceMemoryRemote, WorkspaceMemorySurfaceOptions } from "./web/workspace-memory-surface.ts";
export {
  createWorkspacePanelComponent,
  installWorkspacePanelStyles,
  WORKSPACE_PANEL_ENTRY_KEY,
  WORKSPACE_PANEL_OVERLAY_SLOT,
} from "./web/workspace-panel.ts";
export type { WorkspacePanelOptions, WorkspaceSurfaceComponent } from "./web/workspace-panel.ts";
export {
  createWorkspaceConversationViewComponent,
  workspaceConversationViewRegistration,
  WORKSPACE_VIEW_ENTRY_KEY,
  WORKSPACE_VIEW_LABEL,
  WORKSPACE_VIEW_ORDER,
  WORKSPACE_VIEW_SLOT,
} from "./web/workspace-view.ts";
export type { WorkspaceConversationViewOptions, WorkspaceConversationViewRegistration, WorkspaceViewSlotRegistry } from "./web/workspace-view.ts";
