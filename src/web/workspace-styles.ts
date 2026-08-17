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
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [for="dsh-workspace-view-tab-changes"] {
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
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [data-dsh-workspace-tab="changes"] {
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
[data-dsh-workspace="view"]:has(#dsh-workspace-view-tab-changes:checked) [for="dsh-workspace-view-tab-changes"] {
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
[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="stale"] {
  border-color: color-mix(in srgb, var(--dsw-warning) 50%, transparent);
  color: var(--dsw-warning);
}

[data-dsh-workspace="view"] [data-dsh-workspace="artifact-status-chip"][data-status="error"] {
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
