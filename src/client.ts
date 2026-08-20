import {
  applyWorkspaceConversationContribution,
  createWorkspaceChatNodeComponent,
  type WorkspaceConversationEventRegistry,
  type WorkspaceConversationContributionOptions,
  type WorkspaceSlotRegistry,
  workspaceConversationDefinition,
  workspaceConversationView,
} from "./web/workspace-conversation.ts";
import { createElement, useEffect, useState } from "react";
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
import type { WorkspaceChangesRemote } from "./web/workspace-changes-surface.ts";
import {
  createWorkspaceGitSurfaceComponent,
  type WorkspaceGitRemote,
} from "./web/workspace-git-surface.ts";
import type { MemoryScopeRequest } from "./domain/memory.ts";
import { installWorkspaceStyles } from "./web/workspace-styles.ts";
import {
  createWorkspaceConversationViewComponent,
  workspaceConversationViewRegistration,
  WORKSPACE_VIEW_SLOT,
  type WorkspaceViewSlotRegistry,
} from "./web/workspace-view.ts";
import { workspaceSummaryBlockComponent, type WorkspaceSummaryRemote } from "./web/workspace-summary-block.ts";
import type { WorkspaceSummaryData } from "./host/workspace-summary.ts";
import { startWorkspaceLocaleSync } from "./web/workspace-i18n.ts";

interface ClientContributionContext {
  readonly conversationEvents: WorkspaceConversationEventRegistry;
  readonly slots: WorkspaceSlotRegistry;
  readonly effect: (factory: () => void | (() => void), label?: string) => void;
  readonly inject?: (dependencies: readonly string[], callback: (scope: ClientContributionContext) => void | (() => void)) => { readonly dispose: () => Promise<void> };
  readonly remote: TypertClientRemote;
  readonly sessions?: { readonly scope: (id: string) => { readonly get?: (key: string) => unknown; readonly remote?: TypertClientRemote } | undefined };
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

export const workspaceClient: WorkspaceClientSurface = Object.freeze({ ready: true });

export function renderWorkspacePreview(descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown {
  return createWorkspacePreviewRenderer({ MarkdownText, CodeBlock, JsonTree }, descriptor, options);
}

export const inject = ["slots", "remote"] as const;

export async function apply(ctx: ClientContributionContext): Promise<() => Promise<void>> {
  // rc.7 client protocol (dsh 0.1.0-rc.7): the shell provides `slots`
  // (slot registry with inject/register), `remote` (Typert mount seat) and
  // `effect` (fiber-lifetime). The rc.6-era `conversationEvents`/`sessions`
  // service injection is gone; conversation.view registration rides the
  // session-scoped `conversation.session` parent slot instead (trajectory
  // pattern), and `register.inject(sessionId)` hands the view its session.
  if (!ctx?.slots || typeof ctx.effect !== "function" || !ctx.remote?.$mount) {
    throw new Error("DSH Workspace requires the public slot registry and Typert Remote seams");
  }
  const remoteDispose: TypertDisposer = await ctx.remote.$mount(TYPERT_REMOTE as TypertRemoteContribution);
  let disposeConversation: (() => void) | undefined;
  try {
    ctx.effect(() => {
      // v0.6: the summary is derived on demand and rendered as a block in the
      // Workspace conversation tab (workspaceSummaryBlockComponent). The old
      // conversation.chat.node registration is gone: persisting a
      // workspace/summary custom event made the whole session log unloadable
      // after a restart (cold-read rejects unknown non-ignorable types), so
      // no chat-node event can be emitted anymore (wayfinder #112).
      let disposed = false;
      let disposeSurfaces = () => {};
      const viewSlots = ctx.slots as unknown as WorkspaceViewSlotRegistry;
      const registerWorkspaceSurfaces = (scope: ClientContributionContext): (() => void) => {
        const workspace = (scope.remote as unknown as { readonly workspace?: Record<string, (...args: readonly unknown[]) => Promise<unknown>> }).workspace;
        const remotes = new Map<string, WorkspaceArtifactRemote & WorkspaceMemoryRemote & WorkspaceGitRemote & WorkspaceSummaryRemote>();
        const resolveRemote = (sessionId: string | undefined): WorkspaceArtifactRemote & WorkspaceMemoryRemote & WorkspaceGitRemote & WorkspaceSummaryRemote | undefined => {
          if (!sessionId || !workspace) return undefined;
          const cached = remotes.get(sessionId);
          if (cached) return cached;
          const call = <T>(method: string, ...args: readonly unknown[]): Promise<T> => workspace[method]!(sessionId, ...args) as Promise<T>;
          const adapted: WorkspaceArtifactRemote & WorkspaceMemoryRemote & WorkspaceGitRemote & WorkspaceSummaryRemote = {
            artifactMetadata: () => call("artifactMetadata"),
            previewArtifact: (id: Parameters<WorkspaceArtifactRemote["previewArtifact"]>[0]) => call("previewArtifact", id),
            gitStatus: () => call("gitStatus"),
            gitDiff: (path: Parameters<WorkspaceChangesRemote["gitDiff"]>[0]) => call("gitDiff", path),
            gitHistory: (options: Parameters<WorkspaceGitRemote["gitHistory"]>[0]) => call("gitHistory", options),
            gitCommit: (sha: Parameters<WorkspaceGitRemote["gitCommit"]>[0]) => call("gitCommit", sha),
            gitRepoInfo: () => call("gitRepoInfo"),
            workspaceSummary: () => call<WorkspaceSummaryData | undefined>("workspaceSummary"),
            memoryOpen: (request: Parameters<WorkspaceMemoryRemote["memoryOpen"]>[0]) => call("memoryOpen", request),
            memoryList: (request: Parameters<WorkspaceMemoryRemote["memoryList"]>[0], options: Parameters<WorkspaceMemoryRemote["memoryList"]>[1]) => call("memoryList", request, options),
            memorySearch: (request: Parameters<WorkspaceMemoryRemote["memorySearch"]>[0], query: Parameters<WorkspaceMemoryRemote["memorySearch"]>[1], options: Parameters<WorkspaceMemoryRemote["memorySearch"]>[2]) => call("memorySearch", request, query, options),
            memoryUpsert: (request: Parameters<WorkspaceMemoryRemote["memoryUpsert"]>[0], draft: Parameters<WorkspaceMemoryRemote["memoryUpsert"]>[1]) => call("memoryUpsert", request, draft),
            memoryArchive: (request: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[0], id: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[1], revision: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[2], hash: Parameters<WorkspaceMemoryRemote["memoryArchive"]>[3]) => call("memoryArchive", request, id, revision, hash),
            memoryForget: (request: Parameters<WorkspaceMemoryRemote["memoryForget"]>[0], id: Parameters<WorkspaceMemoryRemote["memoryForget"]>[1], revision: Parameters<WorkspaceMemoryRemote["memoryForget"]>[2], hash: Parameters<WorkspaceMemoryRemote["memoryForget"]>[3]) => call("memoryForget", request, id, revision, hash),
            memoryGovern: (request: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[0], id: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[1], action: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[2], revision: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[3], hash: Parameters<WorkspaceMemoryRemote["memoryGovern"]>[4]) => call("memoryGovern", request, id, action, revision, hash),
            memoryExport: (request: Parameters<WorkspaceMemoryRemote["memoryExport"]>[0]) => call("memoryExport", request),
            memoryImport: (request: Parameters<WorkspaceMemoryRemote["memoryImport"]>[0], serialized: Parameters<WorkspaceMemoryRemote["memoryImport"]>[1]) => call("memoryImport", request, serialized),
            memoryExportMarkdown: (request: Parameters<NonNullable<WorkspaceMemoryRemote["memoryExportMarkdown"]>>[0]) => call("memoryExportMarkdown", request),
            memoryImportMarkdown: (request: Parameters<NonNullable<WorkspaceMemoryRemote["memoryImportMarkdown"]>>[0], markdown: Parameters<NonNullable<WorkspaceMemoryRemote["memoryImportMarkdown"]>>[1]) => call("memoryImportMarkdown", request, markdown),
            memoryMarkUsed: (request: MemoryScopeRequest, id: string) => call("memoryMarkUsed", request, id),
            memoryClose: (request: MemoryScopeRequest) => call("memoryClose", request),
          };
          remotes.set(sessionId, adapted);
          return adapted;
        };
        const disposeStyles = installWorkspaceStyles();
        const disposers: (() => void)[] = [disposeStyles];
        const artifacts = createWorkspaceArtifactSurfaceComponent(undefined, { MarkdownText, CodeBlock, JsonTree }, {
          resolveRemote,
        });
        const memory = createWorkspaceMemorySurfaceComponent({
          resolveRemote,
        });
        const git = createWorkspaceGitSurfaceComponent(undefined, {}, {
          resolveRemote,
        });
        if (typeof viewSlots.inject === "function" && typeof viewSlots.register === "function") {
          disposers.push(viewSlots.inject(WORKSPACE_VIEW_SLOT, () => viewSlots.register(
            workspaceConversationViewRegistration(),
            createWorkspaceConversationViewComponent({
              artifacts,
              memory,
              git,
              summary: workspaceSummaryBlockComponent({ resolveRemote }),
            }),
          )));
        }
        return () => {
          remotes.clear();
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
      };
      return disposeConversation;
    }, "dsh Workspace client contribution");
    // Follow the host application locale (wayfinder #118/#126). The host has
    // no public locale event/hook, so we observe <html lang> + languagechange
    // and update the shared Workspace locale, which re-renders every surface.
    ctx.effect(() => startWorkspaceLocaleSync(), "dsh Workspace locale sync");
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
  workspaceConversationDefinition,
  workspaceConversationView,
};

export type { WorkspaceConversationContributionOptions };
export { createWorkspaceMarkdownContent, createWorkspacePreviewRenderer, sanitizeWorkspaceMarkdown } from "./web/workspace-preview-adapters.ts";
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
  workspaceMemoryTypes,
} from "./web/workspace-memory-surface.ts";
export type { WorkspaceMemoryRemote, WorkspaceMemorySurfaceOptions } from "./web/workspace-memory-surface.ts";
export {
  createWorkspaceChangesSurfaceComponent,
} from "./web/workspace-changes-surface.ts";
export type { WorkspaceChangesRemote, WorkspaceChangesSurfaceOptions } from "./web/workspace-changes-surface.ts";
export {
  createWorkspaceGitSurfaceComponent,
} from "./web/workspace-git-surface.ts";
export type { WorkspaceGitPrimitives, WorkspaceGitRemote, WorkspaceGitSurfaceOptions } from "./web/workspace-git-surface.ts";
export {
  createWorkspaceHistorySurfaceComponent,
} from "./web/workspace-history-surface.ts";
export type { WorkspaceHistoryRemote, WorkspaceHistorySurfaceOptions } from "./web/workspace-history-surface.ts";
export { installWorkspaceStyles } from "./web/workspace-styles.ts";
export type { WorkspaceSurfaceComponent } from "./web/workspace-styles.ts";
export {
  createWorkspaceConversationViewComponent,
  workspaceConversationViewRegistration,
  WORKSPACE_VIEW_ENTRY_KEY,
  WORKSPACE_VIEW_LABEL,
  WORKSPACE_VIEW_ORDER,
  WORKSPACE_VIEW_SLOT,
} from "./web/workspace-view.ts";
export type { WorkspaceConversationViewOptions, WorkspaceConversationViewRegistration, WorkspaceViewSlotRegistry } from "./web/workspace-view.ts";
