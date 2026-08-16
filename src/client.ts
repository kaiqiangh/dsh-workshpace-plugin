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

export const workspaceClient: WorkspaceClientSurface = Object.freeze({ ready: true });

export function renderWorkspacePreview(descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown {
  return createWorkspacePreviewRenderer({ MarkdownText, CodeBlock, JsonTree }, descriptor, options);
}

export const inject = ["conversationEvents", "slots", "remote"] as const;

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
      disposeConversation = () => {
        if (disposed) return;
        disposed = true;
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
