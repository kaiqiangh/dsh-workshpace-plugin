import { createElement, type ReactNode } from "react";

/** A session-scoped Workspace surface component (Artifacts / Memory / Changes). */
export type WorkspaceSurfaceComponent = (props: Record<string, unknown>) => ReactNode;

const WORKSPACE_STYLE_ID = "dsh-workspace-view-styles";

/**
 * Shared Workspace styling for the `conversation.view` tab and the surfaces it
 * hosts. The overlay (`shell.overlay`) pill and its floating drawer styles were
 * retired; only the tab (`[data-dsh-workspace="view"]`) and the shared
 * `[data-dsh-workspace="panel-content"]` surface styles remain.
 *
 * The visual system below (cards, badges, chips, lists, empty/notice states) is
 * scoped to `[data-dsh-workspace="view"]` and the individual surface attributes
 * so it never leaks into the rest of the Harness UI.
 */
const WORKSPACE_VIEW_STYLES = `
[data-dsh-workspace="view"] {
  --dsw-font: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  --dsw-bg: Canvas;
  --dsw-surface: color-mix(in srgb, CanvasText 5%, Canvas);
  --dsw-surface-hover: color-mix(in srgb, CanvasText 9%, Canvas);
  --dsw-border: color-mix(in srgb, CanvasText 14%, transparent);
  --dsw-border-strong: color-mix(in srgb, CanvasText 24%, transparent);
  --dsw-text: CanvasText;
  --dsw-muted: color-mix(in srgb, CanvasText 62%, transparent);
  --dsw-faint: color-mix(in srgb, CanvasText 46%, transparent);
  --dsw-accent: Highlight;
  --dsw-accent-soft: color-mix(in srgb, Highlight 14%, transparent);
  --dsw-success: color-mix(in srgb, #2e9e5b 78%, CanvasText 22%);
  --dsw-warning: color-mix(in srgb, #c98a1b 72%, CanvasText 28%);
  --dsw-danger: color-mix(in srgb, #d4565b 78%, CanvasText 22%);
  /* v0.5: consolidated spacing / type / radius scales (4px base). */
  --dsw-space-1: 4px;
  --dsw-space-2: 8px;
  --dsw-space-3: 12px;
  --dsw-space-4: 16px;
  --dsw-type-xs: 11px;
  --dsw-type-sm: 12px;
  --dsw-type-md: 13px;
  --dsw-type-lg: 15px;
  --dsw-radius: 12px;
  --dsw-radius-sm: 8px;
  --dsw-radius-xs: 6px;
  /* v0.5: two-tone diff palette — pale line tint, stronger word-level shade. */
  --dsw-diff-add-bg: color-mix(in srgb, var(--dsw-success) 17%, transparent);
  --dsw-diff-add-word: color-mix(in srgb, var(--dsw-success) 34%, transparent);
  --dsw-diff-del-bg: color-mix(in srgb, var(--dsw-danger) 17%, transparent);
  --dsw-diff-del-word: color-mix(in srgb, var(--dsw-danger) 34%, transparent);
  --dsw-diff-hunk-bg: color-mix(in srgb, CanvasText 5%, transparent);
  --dsw-diff-band: color-mix(in srgb, CanvasText 4%, Canvas);
  color: var(--dsw-text);
  font-family: var(--dsw-font);
}

[data-dsh-workspace="view"] *,
[data-dsh-workspace="view"] *::before,
[data-dsh-workspace="view"] *::after {
  box-sizing: border-box;
}

[data-dsh-workspace="view"] button,
[data-dsh-workspace="view"] input,
[data-dsh-workspace="view"] select,
[data-dsh-workspace="view"] textarea {
  color: inherit;
  font: inherit;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-content"] {
  min-width: 0;
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [for="dsh-workspace-view-tab-artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [for="dsh-workspace-view-tab-memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [for="dsh-workspace-view-tab-changes"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-git:checked) [for="dsh-workspace-view-tab-git"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: color-mix(in srgb, Highlight 14%, transparent);
  color: CanvasText;
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace-tab] {
  display: none;
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [data-dsh-workspace-tab="artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [data-dsh-workspace-tab="memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [data-dsh-workspace-tab="changes"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-git:checked) [data-dsh-workspace-tab="git"] {
  display: block;
}

[data-dsh-workspace="panel-tabs"] {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
}

[data-dsh-workspace="tab-input"] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

[data-dsh-workspace="panel-tab"] {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: center;
  color: color-mix(in srgb, CanvasText 68%, transparent);
  font-size: 13px;
}

[data-dsh-workspace="panel-tab"]:hover,
[data-dsh-workspace="panel-tab"]:focus-visible {
  border-color: color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 7%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 55%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="panel-content"] {
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

[data-dsh-workspace="panel-content"] > section {
  min-width: 0;
}

[data-dsh-workspace="panel-content"] h2 {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] h3 {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] h4 {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] p,
[data-dsh-workspace="panel-content"] dl,
[data-dsh-workspace="panel-content"] ul,
[data-dsh-workspace="panel-content"] article {
  overflow-wrap: anywhere;
}

[data-dsh-workspace="panel-content"] p {
  margin: 8px 0;
  color: color-mix(in srgb, CanvasText 68%, transparent);
  font-size: 12px;
  line-height: 1.5;
}

[data-dsh-workspace="panel-content"] button,
[data-dsh-workspace="panel-content"] input,
[data-dsh-workspace="panel-content"] select,
[data-dsh-workspace="panel-content"] textarea {
  min-height: 32px;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 8px;
  background: Canvas;
}

[data-dsh-workspace="panel-content"] button {
  padding: 5px 10px;
  cursor: pointer;
}

[data-dsh-workspace="panel-content"] button:disabled {
  cursor: not-allowed;
  opacity: .52;
}

[data-dsh-workspace="panel-content"] button:hover:not(:disabled),
[data-dsh-workspace="panel-content"] button:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="panel-content"] input,
[data-dsh-workspace="panel-content"] select,
[data-dsh-workspace="panel-content"] textarea {
  width: 100%;
  padding: 6px 9px;
}

[data-dsh-workspace="panel-content"] textarea {
  min-height: 92px;
  resize: vertical;
}

[data-dsh-workspace="panel-content"] label {
  display: grid;
  gap: 5px;
  min-width: 0;
  margin: 8px 0;
  color: color-mix(in srgb, CanvasText 72%, transparent);
  font-size: 12px;
}

[data-dsh-workspace="panel-content"] form,
[data-dsh-workspace="panel-content"] [role="group"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 8px 0;
}

[data-dsh-workspace="panel-content"] form[aria-label] {
  display: grid;
  align-items: stretch;
}

[data-dsh-workspace="panel-content"] [role="group"] button {
  flex: 1 1 100px;
}

[data-dsh-workspace="panel-content"] article,
[data-dsh-workspace="panel-content"] aside {
  margin: 10px 0;
  padding: 10px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 10px;
}

[data-dsh-workspace="panel-content"] pre,
[data-dsh-workspace="panel-content"] table {
  max-width: 100%;
  overflow: auto;
}

/* ============ Visual system ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="surface-header"] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  margin: 0 0 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"] h3 {
  font-size: 14px;
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-actions"] {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="count-badge"] {
  flex: none;
  padding: 2px 9px;
  border: 1px solid color-mix(in srgb, Highlight 40%, transparent);
  border-radius: 999px;
  background: var(--dsw-accent-soft);
  color: color-mix(in srgb, Highlight 82%, CanvasText 18%);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="count-badge"][data-dsw-variant="neutral"] {
  border-color: var(--dsw-border);
  background: var(--dsw-surface);
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-toolbar"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-toolbar"] label {
  display: grid;
  gap: 4px;
  margin: 0;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-toolbar"] form {
  margin: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  color: var(--dsw-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .03em;
  line-height: 1.4;
  text-transform: uppercase;
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="created"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="added"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="verified"] {
  border-color: color-mix(in srgb, var(--dsw-success) 45%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="modified"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="unverified"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 45%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="deleted"],
[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="rejected"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 45%, transparent);
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="status-chip"][data-status="stale"] {
  border-color: var(--dsw-border-strong);
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="card"] {
  margin: 0 0 10px;
  padding: 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="empty-state"] {
  margin: 0 0 var(--dsw-space-3);
  padding: var(--dsw-space-4) var(--dsw-space-4);
  border: 1px dashed var(--dsw-border-strong);
  border-radius: var(--dsw-radius);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.6;
  text-align: center;
}

[data-dsh-workspace="view"] [data-dsh-workspace="notice"] {
  margin: 0 0 var(--dsw-space-3);
  padding: var(--dsw-space-2) var(--dsw-space-3);
  border: 1px solid var(--dsw-border);
  border-left: 3px solid var(--dsw-accent);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.5;
}

[data-dsh-workspace="view"] [data-dsh-workspace="notice"][data-dsw-tone="error"] {
  border-left-color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="notice"][data-dsw-tone="warning"] {
  border-left-color: var(--dsw-warning);
}

/* ============ Artifacts ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-surface"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group"] {
  margin: 0 0 12px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group-header"] {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group-header"] h4 {
  font-size: 12px;
  font-weight: 650;
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-group-header"] [data-dsh-workspace="count-badge"] {
  font-size: 10px;
  padding: 1px 7px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="changes-list"] {
  display: grid;
  gap: 6px;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: visible;
  list-style: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-item"] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 10px;
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="change-item"]:hover {
  background: var(--dsw-surface-hover);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"][data-selected="true"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"][data-selected="true"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-item"][data-selected="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  background: var(--dsw-accent-soft);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-type-badge"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 2px 6px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: 6px;
  color: var(--dsw-faint);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .04em;
  text-align: center;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="added"] {
  border-color: color-mix(in srgb, var(--dsw-success) 50%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="modified"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 50%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="deleted"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 50%, transparent);
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="renamed"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-status-badge"][data-status="copied"] {
  border-color: color-mix(in srgb, var(--dsw-accent) 45%, transparent);
  color: color-mix(in srgb, var(--dsw-accent) 80%, CanvasText 20%);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-select"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-select"] {
  min-width: 0;
  padding: 4px 6px;
  border: none;
  background: transparent;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="change-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-select"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="change-select"]:focus-visible {
  border: 1px solid color-mix(in srgb, Highlight 55%, transparent);
  border-radius: 6px;
  outline: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-meta"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-meta"] {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-faint);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-meta"] {
  grid-column: 2 / -1;
  color: var(--dsw-faint);
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"],
[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] {
  margin: 12px 0 0;
  padding: 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] h3,
[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] h3 {
  margin: 0 0 6px;
  font-size: 13px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-provenance"] {
  margin: 0 0 8px;
  color: var(--dsw-faint);
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] [role="group"],
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] form {
  margin: 8px 0 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-block"] {
  margin: 8px 0 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-block"] h4 {
  margin: 0 0 4px;
  color: var(--dsw-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code"] {
  margin: 0;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: Canvas;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* ============ Memory ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="memory-surface"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] label {
  margin: 0;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] [role="group"] {
  margin: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"] {
  grid-template-columns: minmax(0, 1fr) auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-header"] {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"] {
  flex: none;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, CanvasText 60%, transparent);
  font-size: 10px;
  line-height: 1.3;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-verification="verified"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  color: color-mix(in srgb, Highlight 80%, CanvasText 20%);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-verification="unverified"] {
  border-color: color-mix(in srgb, CanvasText 24%, transparent);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-proposal="true"] {
  border-color: color-mix(in srgb, Highlight 40%, transparent);
  background: color-mix(in srgb, Highlight 10%, transparent);
  color: CanvasText;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-preview"] {
  grid-column: 1 / -1;
  color: color-mix(in srgb, CanvasText 52%, transparent);
  font-size: 11px;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-meta"] {
  grid-column: 1 / -1;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-governance"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 12px;
  margin: 10px 0 0;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: Canvas;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-governance"] dt {
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-governance"] dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin: 8px 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] pre {
  margin: 6px 0 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-editor"] summary {
  cursor: pointer;
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-editor"] form {
  display: grid;
  gap: 6px;
}

/* ============ Changes ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="changes-surface"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-item"][data-selected="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
}

/* ============ Chat summary card ============ */

[data-dsh-workspace="summary"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, CanvasText 4%, Canvas);
  color: CanvasText;
  font-size: 12px;
  line-height: 1.5;
}

[data-dsh-workspace="summary"] strong {
  font-size: 13px;
}

[data-dsh-workspace="summary"] [data-dsh-workspace="summary-metric"] {
  color: color-mix(in srgb, CanvasText 62%, transparent);
  white-space: nowrap;
}

/* ============ v0.7: segmented tab chrome ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tabs"] {
  gap: var(--dsw-space-1);
  padding: var(--dsw-space-1);
  margin: var(--dsw-space-3) var(--dsw-space-3) 0;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: var(--dsw-radius);
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"] {
  min-height: 30px;
  font-size: var(--dsw-type-sm);
  border-radius: var(--dsw-radius-xs);
}

[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-artifacts:checked) [for="dsh-workspace-view-tab-artifacts"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-memory:checked) [for="dsh-workspace-view-tab-memory"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [for="dsh-workspace-view-tab-changes"],
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-git:checked) [for="dsh-workspace-view-tab-git"] {
  border-color: color-mix(in srgb, Highlight 50%, transparent);
  background: color-mix(in srgb, Highlight 18%, transparent);
  color: CanvasText;
  font-weight: 650;
  box-shadow: 0 1px 2px color-mix(in srgb, CanvasText 12%, transparent);
}

/* ============ v0.7: filter chips ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"] {
  flex: none;
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  background: var(--dsw-surface);
  color: var(--dsw-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"]:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="filter-chip"][aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 50%, transparent);
  background: var(--dsw-accent-soft);
  color: CanvasText;
}

/* ============ v0.7: two-column list | detail ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="columns"] {
  display: grid;
  gap: 12px;
  min-width: 0;
  align-items: start;
}

@media (min-width: 760px) {
  [data-dsh-workspace="view"] [data-dsh-workspace="columns"] {
    grid-template-columns: minmax(250px, 340px) minmax(0, 1fr);
  }
}

[data-dsh-workspace="view"] [data-dsh-workspace="column-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="column-detail"] {
  min-width: 0;
}

/* ============ v0.7: readable diff ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code"] {
  padding: 0;
  overflow: hidden;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-lines"] {
  display: grid;
  grid-template-columns: min-content min-content minmax(0, 1fr);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-line-num"] {
  padding: 0 6px;
  color: var(--dsw-faint);
  font-size: 10px;
  text-align: right;
  user-select: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-line-text"] {
  padding: 0 10px 0 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="add"] {
  background: var(--dsw-diff-add-bg);
  box-shadow: inset 3px 0 0 var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="remove"] {
  background: var(--dsw-diff-del-bg);
  box-shadow: inset 3px 0 0 var(--dsw-danger);
}

/* v0.5: hunk headers are dimmed (delta-style hierarchy — the file header is the strong band). */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="hunk"] {
  background: var(--dsw-diff-hunk-bg);
  color: var(--dsw-muted);
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code-line"][data-kind="header"] {
  color: var(--dsw-faint);
}

/* ============ v0.7: intra-line (word-level) diff tokens ============ */

/* Unchanged run inside a changed line — quiet, inherits the line color. */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-token"][data-token="equal"] {
  color: inherit;
}

/* Inserted run — stronger highlight than the line-level add background. */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-token"][data-token="added"] {
  background: var(--dsw-diff-add-word);
  border-radius: 2px;
}

/* Deleted run — stronger highlight than the line-level remove background. */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-token"][data-token="removed"] {
  background: var(--dsw-diff-del-word);
  border-radius: 2px;
  text-decoration: line-through;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-stats"] {
  color: var(--dsw-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-stats"] b[data-sign="add"] {
  color: var(--dsw-success);
  font-weight: 700;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-stats"] b[data-sign="del"] {
  color: var(--dsw-danger);
  font-weight: 700;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] [data-dsh-workspace="diff-block"] + [data-dsh-workspace="diff-block"] {
  margin-top: 12px;
}

/* ============ v0.7: artifact status chips ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: 999px;
  color: var(--dsw-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .03em;
  line-height: 1.4;
  text-transform: uppercase;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="available"] {
  border-color: color-mix(in srgb, var(--dsw-success) 50%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="oversized"],
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="parse-error"],
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="stale"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 50%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="error"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 50%, transparent);
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="unavailable"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 50%, transparent);
  color: var(--dsw-danger);
}

/* ============ v0.7: toolbar rows + segmented scopes + primary actions ============ */

[data-dsh-workspace="view"] [data-dsw-row] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsw-row] + [data-dsw-row] {
  margin-top: 8px;
}

[data-dsh-workspace="view"] [data-dsw-segment] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--dsw-border);
  border-radius: 9px;
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsw-segment] button {
  min-height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
}

[data-dsh-workspace="view"] [data-dsw-segment] button[aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: var(--dsw-accent-soft);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-content"] button[data-dsw-primary="true"] {
  background: color-mix(in srgb, Highlight 24%, Canvas);
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  color: CanvasText;
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsw-editor-actions] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

[data-dsh-workspace="view"] [data-dsw-editor-actions] button {
  flex: 1 1 120px;
}

/* ============ v0.7: memory conflict version identity ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] section {
  border: 1px solid var(--dsw-border);
  border-radius: 9px;
  padding: 8px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] section[data-dsw-version="keep"] {
  border-color: color-mix(in srgb, var(--dsw-success) 45%, transparent);
  box-shadow: inset 3px 0 0 var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-conflict-columns"] section[data-dsw-version="conflict"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 45%, transparent);
  box-shadow: inset 3px 0 0 var(--dsw-warning);
}

/* ============ v0.7: artifact item grid with status chip ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"] [data-dsh-workspace="artifact-status-chip"] {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-item"] [data-dsh-workspace="artifact-meta"] {
  grid-column: 1 / -1;
  grid-row: 2;
}

/* ============ v0.5: diff file header (sticky band) ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="change-diff"] {
  scroll-margin-top: 4px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-file-header"] {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--dsw-space-2);
  margin: calc(-1 * var(--dsw-space-3)) calc(-1 * var(--dsw-space-3)) var(--dsw-space-3);
  padding: var(--dsw-space-2) var(--dsw-space-3);
  border-bottom: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius) var(--dsw-radius) 0 0;
  background: var(--dsw-diff-band);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-file-title"] {
  display: flex;
  align-items: center;
  gap: var(--dsw-space-2);
  min-width: 0;
  flex: 1 1 auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-file-title"] h3 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  font-size: var(--dsw-type-md);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-collapse"],
[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"],
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"] {
  flex: none;
  min-height: 26px;
  min-width: 26px;
  padding: 0 var(--dsw-space-2);
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-collapse"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-collapse"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"]:focus-visible,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"]:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-prev"]:disabled,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-next"]:disabled {
  cursor: not-allowed;
  opacity: .45;
}

/* v0.5: unified/split mode toggle (compact segmented control). */
[data-dsh-workspace="view"] [data-dsh-workspace="diff-mode-toggle"] {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-mode-toggle"] button {
  min-height: 22px;
  padding: 0 var(--dsw-space-2);
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-xs);
  background: transparent;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-mode-toggle"] button[aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: var(--dsw-accent-soft);
  color: var(--dsw-text);
  font-weight: 650;
}

/* ============ v0.5: context expander ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] {
  grid-column: 1 / -1;
  padding: var(--dsw-space-1) var(--dsw-space-3);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] button {
  width: 100%;
  min-height: 26px;
  border: 1px dashed var(--dsw-border-strong);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-diff-hunk-bg);
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  font-weight: 600;
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] button:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-expander"] button:focus-visible {
  border-color: color-mix(in srgb, Highlight 55%, CanvasText 18%);
  border-style: solid;
  color: var(--dsw-text);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

/* ============ v0.5: split (side-by-side) view ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-code"][data-mode="split"] {
  overflow-x: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] > [data-dsh-workspace="diff-code-line"] {
  display: contents;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"] {
  display: grid;
  grid-template-columns: min-content minmax(0, 1fr);
  min-width: 0;
  padding-left: var(--dsw-space-1);
  border-left: 1px solid var(--dsw-border);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-code-line"][data-split="full"] [data-dsh-workspace="diff-cell"] {
  grid-column: 1 / -1;
  border-left: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-empty="true"] {
  background: color-mix(in srgb, CanvasText 3%, transparent);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-side="old"][data-kind="remove"] {
  background: var(--dsw-diff-del-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-side="new"][data-kind="add"] {
  background: var(--dsw-diff-add-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-kind="hunk"] {
  background: var(--dsw-diff-hunk-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"][data-kind="header"] {
  background: transparent;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-split"] [data-dsh-workspace="diff-cell"] [data-dsh-workspace="diff-line-text"] {
  padding-right: var(--dsw-space-2);
}

/* ============ v0.5: refresh pill ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="diff-refresh-pill"] {
  display: block;
  width: 100%;
  margin: 0 0 var(--dsw-space-2);
  padding: var(--dsw-space-2);
  border: 1px solid color-mix(in srgb, Highlight 45%, transparent);
  border-radius: 999px;
  background: var(--dsw-accent-soft);
  color: var(--dsw-text);
  font-size: var(--dsw-type-sm);
  font-weight: 650;
  line-height: 1.4;
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="diff-refresh-pill"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="diff-refresh-pill"]:focus-visible {
  border-color: color-mix(in srgb, Highlight 60%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

/* v0.6: session summary block at the top of the Workspace tab. */
[data-dsh-workspace="view"] [data-dsh-workspace="summary-block"] {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-border);
  border-radius: 10px;
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="summary-block-body"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="summary-block-body"] strong {
  font-size: var(--dsw-type-sm);
  font-weight: 700;
}

[data-dsh-workspace="view"] [data-dsh-workspace="summary-block"] [data-dsh-workspace="summary-metric"] {
  font-size: var(--dsw-type-xs);
  color: var(--dsw-text-secondary);
}

/* v0.6: read-only multi-tab preview inside Artifacts (ADR #114). */
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tabs"] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab"] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
  padding: 3px 8px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  background: var(--dsw-surface);
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab"][data-active="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  background: var(--dsw-surface-hover);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab-select"] {
  border: none;
  background: none;
  padding: 0;
  font-size: var(--dsw-type-xs);
  color: var(--dsw-text-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab-close"] {
  border: none;
  background: none;
  padding: 0 2px;
  font-size: var(--dsw-type-sm);
  line-height: 1;
  color: var(--dsw-text-tertiary);
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-tab-close"]:hover {
  color: var(--dsw-text-primary);
}

/* v0.6: SCM grouped display (ADR #115). */
[data-dsh-workspace="view"] [data-dsh-workspace="change-groups"] {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="change-group-title"] {
  margin: 0 0 4px;
  font-size: var(--dsw-type-xs);
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dsw-text-tertiary);
}

/* v0.6: rendered markdown preview (self-contained; mermaid diagrams scroll). */
[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] {
  overflow-x: auto;
  line-height: 1.6;
}

[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] img {
  max-width: 100%;
}

[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] .dsh-workspace-mermaid {
  overflow-x: auto;
  margin: 8px 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace-preview="markdown"] pre {
  overflow-x: auto;
  padding: 8px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 8px;
  background: var(--dsw-surface-hover);
}

/* ============ v0.7: Memory surface redesign (#128) ============ */

/* Toolbar: the search input grows and pins Export/Import to the right edge. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-search"] {
  flex: 1 1 180px;
  min-width: 180px;
  max-width: 100%;
  width: auto;
  margin: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-import"] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  cursor: pointer;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-import"] input {
  width: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-field"] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  white-space: nowrap;
}

/* Type/status filters are bare selects in the primary toolbar row. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-filter-field"] {
  width: auto;
  min-width: 120px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-field"] input:not([type="checkbox"]) {
  width: auto;
  min-width: 120px;
}

/* Pushes Export/Import to the right edge of the toolbar (prototype #123). */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar-spacer"] {
  flex: 1 1 auto;
}

/* Scope buttons and governance terms get the dotted-underline tip affordance. */
[data-dsh-workspace="view"] [data-dsw-segment] button[data-tip],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-tip"] {
  border-bottom: 1px dotted var(--dsw-border-strong);
  cursor: help;
}

/* Record list cards: title + time row, chip row, one-line preview. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"] {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border-left: 2px solid transparent;
}

/* Unselected cards never shift: hover only tints the background (no border jitter). */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"]:hover {
  border-left-color: transparent;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"][data-selected="true"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"][data-selected="true"]:hover {
  border-color: var(--dsw-border);
  border-left-color: var(--dsw-accent);
  background: var(--dsw-accent-soft);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-title-row"] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-title-row"] [data-dsh-workspace="memory-select"] {
  flex: 1 1 auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-time"] {
  flex: none;
  color: var(--dsw-faint);
  font-size: 10px;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-chips"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* Chips: max two per card (type + verification) plus the model-suggested marker. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"] {
  flex: none;
  display: inline-flex;
  align-items: center;
  max-width: 140px;
  padding: 1px 7px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: 999px;
  color: var(--dsw-muted);
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-type] {
  border-color: color-mix(in srgb, Highlight 40%, transparent);
  background: var(--dsw-accent-soft);
  color: color-mix(in srgb, Highlight 82%, CanvasText 18%);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-verification="verified"] {
  border-color: color-mix(in srgb, var(--dsw-success) 50%, transparent);
  background: color-mix(in srgb, var(--dsw-success) 12%, transparent);
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-verification="unverified"] {
  border-color: color-mix(in srgb, CanvasText 24%, transparent);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-badge"][data-dsh-workspace-proposal="true"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 50%, transparent);
  background: color-mix(in srgb, var(--dsw-warning) 12%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-preview"] {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Detail: scrollable monospace content + governance + action row. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail-header"] {
  margin: 0 0 8px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail-header"] h3 {
  font-size: var(--dsw-type-lg);
  font-weight: 650;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail-meta"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin: 6px 0 0;
  color: var(--dsw-muted);
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail-meta-text"] {
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-content"] {
  margin: 0 0 12px;
  padding: 12px;
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Long source ids truncate with an ellipsis; the full value is in title. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-source"] {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] button {
  min-height: 32px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] button[data-dsw-tone="danger"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 45%, transparent);
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] button[data-dsw-tone="danger"]:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--dsw-danger) 60%, transparent);
  background: color-mix(in srgb, var(--dsw-danger) 10%, transparent);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-panel"] {
  margin: 12px 0 0;
  padding: 10px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-panel"] h4 {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-panel"] h4 + h4 {
  margin-top: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-detail"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  font-size: 11px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-detail"] dt {
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-detail"] dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-refs"] {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-source-refs"] li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

/* ============ v0.7: Git tab — repo status header ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="git-repo-header"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-status-pill"],
[data-dsh-workspace="view"] [data-dsh-workspace="git-count-pill"] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 999px;
  background: Canvas;
  font-size: var(--dsw-type-sm);
  line-height: 1.4;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-status-dot"] {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-status-dot"][data-state="clean"] {
  background: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-status-dot"][data-state="dirty"] {
  background: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-status-text"] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-branch"] {
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-head"] {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-ahead-behind"] {
  color: var(--dsw-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-count-pill"] {
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-header-spacer"] {
  flex: 1 1 auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  margin: 0 0 10px;
  padding: 3px;
  border: 1px solid var(--dsw-border);
  border-radius: 9px;
  background: color-mix(in srgb, CanvasText 4%, Canvas);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] button {
  min-height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: var(--dsw-type-sm);
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] button[aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: var(--dsw-accent-soft);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-pane"][hidden] {
  display: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-nongit"] {
  padding: 24px 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-nongit-title"] {
  margin: 0 0 6px;
  font-size: var(--dsw-type-lg);
  font-weight: 650;
  color: var(--dsw-text);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-nongit-hint"] {
  margin: 0;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
}

/* ============ v0.7: History surface ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="history-list-column"],
[data-dsh-workspace="view"] [data-dsh-workspace="history-detail-column"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-graph-bar"] {
  margin: 0 0 6px;
  padding: 4px 8px;
  border: 1px dashed var(--dsw-border-strong);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-diff-band);
  color: var(--dsw-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  line-height: 1.5;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-list"] {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit"] {
  display: grid;
  gap: 2px 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-border);
  border-radius: 10px;
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit"]:hover {
  background: var(--dsw-surface-hover);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit"][data-selected="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  background: var(--dsw-accent-soft);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-select"] {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-hash"] {
  flex: none;
  width: 52px;
  color: color-mix(in srgb, Highlight 85%, CanvasText 15%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-subject"] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-deco"] {
  flex: none;
  color: color-mix(in srgb, Highlight 80%, CanvasText 20%);
  font-size: var(--dsw-type-xs);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-meta"] {
  grid-column: 1 / -1;
  color: var(--dsw-faint);
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-detail"] {
  margin: 12px 0 0;
  padding: 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-subject"] {
  margin: 0 0 6px;
  font-size: var(--dsw-type-md);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-hash"] {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-kv-list"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 3px 12px;
  margin: 10px 0 0;
  font-size: var(--dsw-type-sm);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-kv"] {
  display: contents;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-kv"] dt {
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-kv"] dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-files"] {
  margin: 12px 0 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-files"] h4 {
  margin: 0 0 6px;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  text-transform: uppercase;
  letter-spacing: .04em;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-file-list"] {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  overflow: hidden;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-file"] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--dsw-border);
  font-size: var(--dsw-type-sm);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-file"]:last-child {
  border-bottom: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-file-path"] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-files"] {
  margin: 12px 0 0;
  display: grid;
  gap: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file"] {
  min-width: 0;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  overflow: hidden;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file-header"] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-border);
  background: var(--dsw-diff-band);
  font-size: var(--dsw-type-sm);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file-path"] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file"] [data-dsh-workspace="diff-code"] {
  border: 0;
  border-radius: 0;
}

/* ============ v0.7: History detail — hash-first summary block ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="history-detail-hash"] {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-md);
  font-weight: 650;
  color: color-mix(in srgb, Highlight 85%, CanvasText 15%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-detail-deco"] {
  margin: 4px 0 0;
  color: color-mix(in srgb, Highlight 80%, CanvasText 20%);
  font-size: var(--dsw-type-xs);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-detail-subject"] {
  margin: 4px 0 0;
  font-size: var(--dsw-type-md);
  font-weight: 650;
  overflow-wrap: anywhere;
}

/* ============ v0.7: Git Changes pane (prototype #124) ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 10px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--dsw-border);
  border-radius: 0;
  background: transparent;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] button {
  min-height: 30px;
  padding: 6px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-md);
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] button:hover:not([aria-pressed="true"]) {
  color: var(--dsw-text);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-segment"] button[aria-pressed="true"] {
  border-bottom-color: var(--dsw-accent);
  background: transparent;
  color: var(--dsw-text);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-changes-filter"] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-changes-columns"] {
  display: grid;
  gap: 12px;
  min-width: 0;
  align-items: start;
  grid-template-columns: 260px minmax(0, 1fr);
}

@media (max-width: 860px) {
  [data-dsh-workspace="view"] [data-dsh-workspace="git-changes-columns"] {
    grid-template-columns: minmax(0, 1fr);
  }
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-changes-list"],
[data-dsh-workspace="view"] [data-dsh-workspace="git-changes-detail"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-groups"] {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-group-title"] {
  margin: 0 0 4px;
  font-size: var(--dsw-type-xs);
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-list"] {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  overflow: hidden;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-row"] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-border);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-row"]:last-child {
  border-bottom: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-row"]:hover {
  background: var(--dsw-surface-hover);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-row"][data-selected="true"] {
  background: var(--dsw-accent-soft);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-status"] {
  flex: none;
  width: 14px;
  text-align: center;
  font-size: var(--dsw-type-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-status"][data-status="added"] {
  color: var(--dsw-success);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-status"][data-status="modified"] {
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-status"][data-status="deleted"] {
  color: var(--dsw-danger);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-status"][data-status="untracked"] {
  color: var(--dsw-faint);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-select"] {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-sm);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-select"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="git-file-select"]:focus-visible {
  border: 1px solid color-mix(in srgb, Highlight 55%, transparent);
  border-radius: 6px;
  outline: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-file-sig"] {
  flex: none;
  color: var(--dsw-faint);
  font-size: var(--dsw-type-xs);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff"] {
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  overflow: hidden;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-header"] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dsw-border);
  background: var(--dsw-diff-band);
  font-size: var(--dsw-type-sm);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-path"] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-mode"] {
  flex: none;
  padding: 1px 8px;
  border: 1px solid var(--dsw-border);
  border-radius: 6px;
  background: Canvas;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-stats"] {
  flex: none;
  color: var(--dsw-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-code"] {
  margin: 0;
  padding: 0;
  overflow: auto;
  max-height: 340px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-sm);
  line-height: 1.55;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-line"] {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-num"] {
  flex: none;
  width: 3.4em;
  padding: 0 6px;
  text-align: right;
  color: var(--dsw-faint);
  font-size: var(--dsw-type-xs);
  user-select: none;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-text"] {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 10px 0 4px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-line"][data-kind="add"] {
  background: var(--dsw-diff-add-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-line"][data-kind="remove"] {
  background: var(--dsw-diff-del-bg);
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-line"][data-kind="hunk"] {
  background: var(--dsw-diff-hunk-bg);
  color: var(--dsw-muted);
  font-weight: 600;
}

[data-dsh-workspace="view"] [data-dsh-workspace="git-diff-line"][data-kind="header"] {
  color: var(--dsw-faint);
}

/* ============ v0.8: centered inspection shell ============ */

[data-dsh-workspace="view"] {
  box-sizing: border-box;
  width: min(100%, 1240px);
  max-width: 100%;
  margin-inline: auto;
  padding: 14px 20px 40px;
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tabs"],
[data-dsh-workspace="view"] [data-dsh-workspace="panel-content"] {
  width: 100%;
  max-width: 1180px;
  margin-inline: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tabs"] {
  padding: 5px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: 12px;
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"] {
  min-height: 38px;
  color: var(--dsw-muted);
  font-weight: 550;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"]:hover,
[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"]:focus-visible {
  color: var(--dsw-text);
  outline: 2px solid color-mix(in srgb, Highlight 45%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="columns"] > *,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-list-stack"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-metadata"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 5px 12px;
  margin: 12px 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
  font-size: var(--dsw-type-sm);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-metadata"] dt {
  color: var(--dsw-muted);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-metadata"] dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-path"] {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============ v0.8: Memory scope rail and rendered detail ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="memory-list-stack"] {
  display: grid;
  gap: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-rail"] {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--dsw-border-strong);
  border-radius: var(--dsw-radius);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-rail-heading"] {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-hint"] {
  margin: -4px 0 0;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-sm);
  line-height: 1.45;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-eyebrow"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-field-label"] {
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-rail"] [data-dsw-segment] {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-rail"] [data-dsw-segment] button {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-location"],
[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-key"] {
  display: grid;
  gap: 4px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-location"] code,
[data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-key"] code {
  display: block;
  min-width: 0;
  padding: 5px 7px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-xs);
  background: Canvas;
  color: var(--dsw-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--dsw-type-xs);
  overflow-wrap: anywhere;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-content-label"] {
  margin: 14px 0 6px;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-content"] {
  min-width: 0;
  max-height: 220px;
  overflow: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-content"] [data-dsh-workspace-preview="markdown"] {
  min-width: 0;
}

/* ============ v0.8: readable Git DAG ============ */

[data-dsh-workspace="view"] [data-dsh-workspace="history-scope"] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 12px;
  padding: 4px;
  border: 1px solid var(--dsw-border);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-surface);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-scope"] button {
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-muted);
  cursor: pointer;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-scope"] button[aria-pressed="true"] {
  border-color: color-mix(in srgb, Highlight 55%, transparent);
  background: var(--dsw-accent-soft);
  color: var(--dsw-text);
  font-weight: 650;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-row"] {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-list-column"] {
  max-height: 560px;
  overflow: auto;
  padding-right: 4px;
  scrollbar-gutter: stable;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-detail-column"] {
  position: sticky;
  top: 8px;
  max-height: min(680px, calc(100vh - 180px));
  overflow: auto;
  scrollbar-gutter: stable;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-graph"] {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 13px;
  align-items: center;
  width: 32px;
  max-width: 32px;
  overflow: hidden;
  min-height: 28px;
  color: var(--dsw-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1;
  text-align: center;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-select"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-areas:
    "hash subject"
    "hash decoration";
  align-items: center;
  gap: 2px 8px;
  width: 100%;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-hash"] {
  grid-area: hash;
  width: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-subject"] {
  grid-area: subject;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-deco"] {
  grid-area: decoration;
  justify-self: start;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-graph-lane"][data-active="true"] {
  color: var(--dsw-accent);
  font-weight: 800;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-graph-lane"][data-parent="true"] {
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-meta"] {
  margin-left: 40px;
  padding-left: 0;
  color: var(--dsw-muted);
  font-size: var(--dsw-type-xs);
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file"] [data-dsh-workspace="diff-code"] {
  max-height: 420px;
  overflow: auto;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file"] [data-dsh-workspace="diff-code-line"] {
  min-width: max-content;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-diff-file"] [data-dsh-workspace="diff-line-text"] {
  white-space: pre;
  overflow-wrap: normal;
}

[data-dsh-workspace="view"] [data-dsh-workspace="history-commit-detail"],
[data-dsh-workspace="view"] [data-dsh-workspace="git-diff"],
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-detail"] {
  min-width: 0;
  overflow: hidden;
}

/* v0.8 follow-up: keep the three surfaces centered and readable at narrow widths. */
[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"],
[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"],
[data-dsh-workspace="view"] [data-dsh-workspace="surface-actions"] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="panel-tab"] {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-text);
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-header"] > *,
[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"] h3 {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-title"] h3 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="surface-actions"] {
  justify-content: flex-end;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] [data-dsw-row] {
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] [data-dsw-row]:first-child > :first-child {
  flex: 1 1 240px;
  min-width: 0;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-toolbar"] select {
  min-width: 120px;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-title-row"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  align-items: start;
  width: 100%;
}

/* ponytail: shared cards center their children; Memory cards need a stable
   full-width content column so title, metadata, and preview align together. */
[data-dsh-workspace="view"] [data-dsh-workspace="memory-card"] {
  align-items: stretch;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-select"] {
  display: -webkit-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--dsw-text);
  text-overflow: ellipsis;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-card-time"] {
  min-width: 0;
  max-width: 10rem;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-preview"] {
  align-self: stretch;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-detail-header"] h3 {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--dsw-text);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] {
  padding-top: 10px;
  border-top: 1px solid var(--dsw-border);
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] button[data-dsw-primary="true"] {
  border-color: Highlight;
  background: Highlight;
  color: HighlightText;
}

[data-dsh-workspace="view"] [data-dsh-workspace="memory-actions"] button[data-dsw-tone="danger"] {
  border-color: color-mix(in srgb, var(--dsw-danger) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-danger) 10%, Canvas);
  color: var(--dsw-danger);
}

@media (max-width: 759px) {
  [data-dsh-workspace="view"] {
    padding-inline: 12px;
  }

  [data-dsh-workspace="view"] [data-dsh-workspace="memory-scope-rail"] [data-dsw-segment] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  [data-dsh-workspace="view"] [data-dsh-workspace="history-commit-meta"] {
    margin-left: 0;
    padding-left: 0;
  }

  [data-dsh-workspace="view"] [data-dsh-workspace="history-detail-column"] {
    position: static;
    max-height: none;
    overflow: visible;
  }

  [data-dsh-workspace="view"] [data-dsh-workspace="memory-card-title-row"] {
    grid-template-columns: minmax(0, 1fr);
  }

  [data-dsh-workspace="view"] [data-dsh-workspace="memory-card-time"] {
    max-width: 100%;
    text-align: left;
  }
}
`;

let styleUsers = 0;

export function installWorkspaceStyles(): () => void {
  const dom = typeof document === "object" ? document : undefined;
  if (!dom || typeof dom.getElementById !== "function" || typeof dom.createElement !== "function" || !dom.head || typeof dom.head.appendChild !== "function") return () => undefined;
  let style = dom.getElementById(WORKSPACE_STYLE_ID);
  if (!style) {
    style = dom.createElement("style");
    style.id = WORKSPACE_STYLE_ID;
    style.textContent = WORKSPACE_VIEW_STYLES;
    dom.head.appendChild(style);
  }
  styleUsers += 1;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    styleUsers -= 1;
    if (styleUsers === 0) style?.remove();
  };
}
