import { createElement, type ReactNode } from "react";

/**
 * Shared Workspace surface UI atoms. Every element reuses the scoped
 * `[data-dsh-workspace]` vocabulary from workspace-styles.ts so the three
 * surfaces (Artifacts / Memory / Changes) stay visually consistent without
 * leaking into the rest of the Harness UI.
 */

export interface WorkspaceSurfaceHeaderParts {
  readonly title: string;
  readonly count?: ReactNode;
  readonly actions?: ReactNode;
}

/** A notice callout with an informational/warning/error tone. */
export function workspaceNotice(tone: "info" | "warning" | "error", children: ReactNode, key?: string): ReactNode {
  return createElement(
    "div",
    { key, "data-dsh-workspace": "notice", "data-dsw-tone": tone },
    createElement("p", { role: "status" }, children),
  );
}

/** A dashed empty-state callout with guidance. */
export function workspaceEmptyState(children: ReactNode, key?: string): ReactNode {
  return createElement("div", { key, "data-dsh-workspace": "empty-state" }, children);
}

/** A pill count badge. `text` is the fully-formed label (e.g. "2 changes"). */
export function workspaceCountBadge(text: string, variant: "accent" | "neutral" = "accent", key?: string): ReactNode {
  return createElement(
    "span",
    { key, "data-dsh-workspace": "count-badge", ...(variant === "neutral" ? { "data-dsw-variant": "neutral" } : {}) },
    text,
  );
}

/** Surface header row: title + optional count badge + optional action buttons. */
export function workspaceSurfaceHeader(parts: WorkspaceSurfaceHeaderParts): ReactNode {
  return createElement(
    "header",
    { "data-dsh-workspace": "surface-header" },
    createElement("div", { "data-dsh-workspace": "surface-title" },
      createElement("h3", null, parts.title),
      parts.count,
    ),
    parts.actions && createElement("div", { "data-dsh-workspace": "surface-actions" }, parts.actions),
  );
}

/** An uppercase status chip; `status` drives the CSS color (success/warning/danger/neutral). */
export function workspaceStatusChip(label: string, status: string, key?: string): ReactNode {
  return createElement("span", { key, "aria-hidden": "true", "data-dsh-workspace": "status-chip", "data-status": status }, label);
}

/** A filter chip button with pressed state. */
export function workspaceFilterChip(label: string, active: boolean, onClick: () => void, key?: string): ReactNode {
  return createElement(
    "button",
    { key, type: "button", "data-dsh-workspace": "filter-chip", "aria-pressed": active, onClick },
    label,
  );
}

/** A segmented control row (e.g. Memory scope switcher). */
export function workspaceSegment(label: string, children: ReactNode, key?: string): ReactNode {
  return createElement("div", { key, role: "group", "aria-label": label, "data-dsw-segment": "true" }, children);
}

/** A toolbar row inside a surface toolbar. */
export function workspaceToolbarRow(children: ReactNode, key?: string): ReactNode {
  return createElement("div", { key, "data-dsw-row": "true" }, children);
}
