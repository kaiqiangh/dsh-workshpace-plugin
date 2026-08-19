import { createElement, type ReactNode } from "react";

import type { WorkspaceSurfaceComponent } from "./workspace-styles.ts";
import { t, useWorkspaceLocale } from "./workspace-i18n.ts";

/** The public Harness conversation view ring: one list entry per view tab. */
export const WORKSPACE_VIEW_SLOT = "conversation.view" as const;
export const WORKSPACE_VIEW_ENTRY_KEY = "dsh-workspace" as const;
export const WORKSPACE_VIEW_ORDER = 20 as const;
export const WORKSPACE_VIEW_LABEL = "Workspace" as const;
export const WORKSPACE_VIEW_LOCALE_NS = "dsh-workspace" as const;

/**
 * Props the view body receives from the rc.7 `register.inject(sessionId)`
 * seat. The conversation.view hole is session-scoped (children of
 * `conversation.session` with `scope: "session"`), so the shell passes the
 * active session id into `inject`; we surface it back as the `useSessions`
 * seat the surfaces already read (dsh-web-ui trajectory pattern).
 */
export interface WorkspaceConversationViewInjectedProps {
  readonly useSessions: () => string | undefined;
}

export interface WorkspaceConversationViewRegistration {
  readonly name: typeof WORKSPACE_VIEW_SLOT;
  readonly id: typeof WORKSPACE_VIEW_ENTRY_KEY;
  readonly order: typeof WORKSPACE_VIEW_ORDER;
  readonly locale: typeof WORKSPACE_VIEW_LOCALE_NS;
  readonly label: () => string;
  readonly inject: (sessionId: string) => WorkspaceConversationViewInjectedProps;
}

/** Pinned registration descriptor; the client contribution registers this into `conversation.view`. */
export function workspaceConversationViewRegistration(): WorkspaceConversationViewRegistration {
  return Object.freeze({
    name: WORKSPACE_VIEW_SLOT,
    id: WORKSPACE_VIEW_ENTRY_KEY,
    order: WORKSPACE_VIEW_ORDER,
    locale: WORKSPACE_VIEW_LOCALE_NS,
    label: () => t("view.workspace"),
    inject: (sessionId: string) => Object.freeze({ useSessions: () => sessionId }),
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
  readonly git: WorkspaceSurfaceComponent;
  /** Optional read-only summary block rendered above the surface tabs. */
  readonly summary?: WorkspaceSurfaceComponent;
}

/**
 * Conversation view tab body: the Artifacts/Memory/Git switch rendered in the
 * tab row's body (IA #125: tab order Artifacts → Memory → Git; the Git tab
 * hosts the Changes/History segmented switch internally). Session-scoped slot
 * components receive the global `useSessions` seat, which the surfaces already
 * read, so no remote-resolution changes are needed.
 */
export function createWorkspaceConversationViewComponent(options: WorkspaceConversationViewOptions): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceConversationView(props: Record<string, unknown>): ReactNode {
    // Re-render on locale change; child surfaces (artifacts/memory/git/
    // summary) cascade from this single subscription.
    useWorkspaceLocale();
    // v0.7 (IA #125): the third tab is the Git tab (hosts Changes/History).
    const children: ReactNode[] = [];
    if (options.summary) children.push(createElement(options.summary, props));
    children.push(
      createElement("input", { id: "dsh-workspace-view-tab-artifacts", name: "dsh-workspace-view-tab", type: "radio", defaultChecked: true, "data-dsh-workspace": "tab-input", "aria-label": t("view.artifacts") }),
      createElement("input", { id: "dsh-workspace-view-tab-memory", name: "dsh-workspace-view-tab", type: "radio", "data-dsh-workspace": "tab-input", "aria-label": t("view.memory") }),
      createElement("input", { id: "dsh-workspace-view-tab-git", name: "dsh-workspace-view-tab", type: "radio", "data-dsh-workspace": "tab-input", "aria-label": t("view.git") }),
      createElement("div", { role: "group", "aria-label": t("view.workspace"), "data-dsh-workspace": "panel-tabs" },
        createElement("label", { htmlFor: "dsh-workspace-view-tab-artifacts", "data-dsh-workspace": "panel-tab" }, t("view.artifacts")),
        createElement("label", { htmlFor: "dsh-workspace-view-tab-memory", "data-dsh-workspace": "panel-tab" }, t("view.memory")),
        createElement("label", { htmlFor: "dsh-workspace-view-tab-git", "data-dsh-workspace": "panel-tab" }, t("view.git")),
      ),
      createElement("div", { "data-dsh-workspace": "panel-content" },
        createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "artifacts" }, createElement(options.artifacts, props)),
        createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "memory" }, createElement(options.memory, props)),
        createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "git" }, createElement(options.git, props)),
      ),
    );
    return createElement("section", { role: "region", "aria-label": t("view.workspace"), "data-dsh-workspace": "view" }, children);
  };
}
