import { createElement, type ReactNode } from "react";

import type { WorkspaceSurfaceComponent } from "./workspace-panel.ts";

/** The public Harness conversation view ring: one list entry per view tab. */
export const WORKSPACE_VIEW_SLOT = "conversation.view" as const;
export const WORKSPACE_VIEW_ENTRY_KEY = "dsh-workspace" as const;
export const WORKSPACE_VIEW_ORDER = 20 as const;
export const WORKSPACE_VIEW_LABEL = "Workspace" as const;

export interface WorkspaceConversationViewRegistration {
  readonly name: typeof WORKSPACE_VIEW_SLOT;
  readonly id: typeof WORKSPACE_VIEW_ENTRY_KEY;
  readonly order: typeof WORKSPACE_VIEW_ORDER;
  readonly label: typeof WORKSPACE_VIEW_LABEL;
}

/** Pinned registration descriptor; the client contribution registers this into `conversation.view`. */
export function workspaceConversationViewRegistration(): WorkspaceConversationViewRegistration {
  return Object.freeze({
    name: WORKSPACE_VIEW_SLOT,
    id: WORKSPACE_VIEW_ENTRY_KEY,
    order: WORKSPACE_VIEW_ORDER,
    label: WORKSPACE_VIEW_LABEL,
  });
}

/**
 * Structural face of the Harness slot registry for the `conversation.view`
 * slot. Mirrors the existing `WorkspaceOverlaySlotRegistry` cast: the slot
 * row is declared by `@deepseek-ai/dsh-client-ui-conversation` at runtime,
 * and the plugin types it structurally so no first-party package is required.
 */
export interface WorkspaceViewSlotRegistry {
  readonly inject: (key: typeof WORKSPACE_VIEW_SLOT, callback: () => () => void) => () => void;
  readonly register: (options: WorkspaceConversationViewRegistration, component: WorkspaceSurfaceComponent) => () => void;
}

export interface WorkspaceConversationViewOptions {
  readonly artifacts: WorkspaceSurfaceComponent;
  readonly memory: WorkspaceSurfaceComponent;
}

/**
 * Conversation view tab body: the Artifacts/Memory switch rendered in the
 * tab row's body, reusing the existing surfaces unchanged. Session-scoped
 * slot components receive the global `useSessions` seat, which the surfaces
 * already read, so no remote-resolution changes are needed.
 */
export function createWorkspaceConversationViewComponent(options: WorkspaceConversationViewOptions): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceConversationView(props: Record<string, unknown>): ReactNode {
    return createElement(
      "section",
      { role: "region", "aria-label": "Workspace", "data-dsh-workspace": "view" },
      createElement("input", { id: "dsh-workspace-view-tab-artifacts", name: "dsh-workspace-view-tab", type: "radio", defaultChecked: true, "data-dsh-workspace": "tab-input", "aria-label": "Artifacts" }),
      createElement("input", { id: "dsh-workspace-view-tab-memory", name: "dsh-workspace-view-tab", type: "radio", "data-dsh-workspace": "tab-input", "aria-label": "Memory" }),
      createElement("div", { role: "group", "aria-label": "Workspace sections", "data-dsh-workspace": "panel-tabs" },
        createElement("label", { htmlFor: "dsh-workspace-view-tab-artifacts", "data-dsh-workspace": "panel-tab" }, "Artifacts"),
        createElement("label", { htmlFor: "dsh-workspace-view-tab-memory", "data-dsh-workspace": "panel-tab" }, "Memory"),
      ),
      createElement("div", { "data-dsh-workspace": "panel-content" },
        createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "artifacts" }, createElement(options.artifacts, props)),
        createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "memory" }, createElement(options.memory, props)),
      ),
    );
  };
}
