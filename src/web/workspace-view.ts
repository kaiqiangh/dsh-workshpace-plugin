import { createElement, useState, type ReactNode } from "react";

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

const WORKSPACE_TAB_IDS = [
  "dsh-workspace-view-tab-artifacts",
  "dsh-workspace-view-tab-memory",
  "dsh-workspace-view-tab-git",
] as const;

function activateWorkspaceTab(event: { readonly key?: string; readonly currentTarget?: { readonly htmlFor?: string }; preventDefault: () => void }): void {
  const key = event.key;
  if (key !== "Enter" && key !== " " && key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
  const id = event.currentTarget?.htmlFor;
  if (!id || typeof document === "undefined") return;
  const current = WORKSPACE_TAB_IDS.indexOf(id as typeof WORKSPACE_TAB_IDS[number]);
  const next = key === "ArrowRight"
    ? WORKSPACE_TAB_IDS[(current + 1) % WORKSPACE_TAB_IDS.length]
    : key === "ArrowLeft"
      ? WORKSPACE_TAB_IDS[(current - 1 + WORKSPACE_TAB_IDS.length) % WORKSPACE_TAB_IDS.length]
      : key === "Home"
        ? WORKSPACE_TAB_IDS[0]
        : key === "End"
          ? WORKSPACE_TAB_IDS[WORKSPACE_TAB_IDS.length - 1]
          : id;
  const input = document.getElementById(next) as HTMLInputElement | null;
  if (!input) return;
  event.preventDefault();
  input.click();
  const label = document.querySelector(`[for="${next}"]`) as HTMLElement | null;
  label?.focus();
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
    const [activeTab, setActiveTab] = useState<typeof WORKSPACE_TAB_IDS[number]>(WORKSPACE_TAB_IDS[0]);
    const tab = (id: typeof WORKSPACE_TAB_IDS[number], label: string, panelId: string): ReactNode => createElement("label", {
      key: id,
      role: "tab",
      tabIndex: activeTab === id ? 0 : -1,
      "aria-selected": activeTab === id,
      "aria-controls": panelId,
      htmlFor: id,
      "data-dsh-workspace": "panel-tab",
      onKeyDown: activateWorkspaceTab,
    }, label);
    const children: ReactNode[] = [];
    if (options.summary) children.push(createElement(options.summary, { ...props, key: "workspace-summary" }));
    children.push(
      ...WORKSPACE_TAB_IDS.map((id, index) => createElement("input", {
        key: `tab-input-${id}`,
        id,
        name: "dsh-workspace-view-tab",
        type: "radio",
        checked: activeTab === id,
        onChange: () => setActiveTab(id),
        "data-dsh-workspace": "tab-input",
        "aria-hidden": "true",
        tabIndex: -1,
      })),
      createElement("div", { key: "panel-tabs", role: "tablist", "aria-label": t("view.workspace"), "data-dsh-workspace": "panel-tabs" },
        tab(WORKSPACE_TAB_IDS[0], t("view.artifacts"), "dsh-workspace-view-panel-artifacts"),
        tab(WORKSPACE_TAB_IDS[1], t("view.memory"), "dsh-workspace-view-panel-memory"),
        tab(WORKSPACE_TAB_IDS[2], t("view.git"), "dsh-workspace-view-panel-git"),
      ),
      createElement("div", { key: "panel-content", "data-dsh-workspace": "panel-content" },
        createElement("div", { key: "tab-content-artifacts", id: "dsh-workspace-view-panel-artifacts", role: "tabpanel", "aria-labelledby": WORKSPACE_TAB_IDS[0], hidden: activeTab !== WORKSPACE_TAB_IDS[0], "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "artifacts" }, createElement(options.artifacts, props)),
        createElement("div", { key: "tab-content-memory", id: "dsh-workspace-view-panel-memory", role: "tabpanel", "aria-labelledby": WORKSPACE_TAB_IDS[1], hidden: activeTab !== WORKSPACE_TAB_IDS[1], "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "memory" }, createElement(options.memory, props)),
        createElement("div", { key: "tab-content-git", id: "dsh-workspace-view-panel-git", role: "tabpanel", "aria-labelledby": WORKSPACE_TAB_IDS[2], hidden: activeTab !== WORKSPACE_TAB_IDS[2], "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "git" }, createElement(options.git, props)),
      ),
    );
    return createElement("section", { role: "region", "aria-label": t("view.workspace"), "data-dsh-workspace": "view" }, children);
  };
}
