import { createElement, type ReactNode } from "react";

export const WORKSPACE_PANEL_OVERLAY_SLOT = "shell.overlay" as const;
export const WORKSPACE_PANEL_ENTRY_KEY = "dsh-workspace-panel" as const;

export type WorkspaceSurfaceComponent = (props: Record<string, unknown>) => ReactNode;

export interface WorkspacePanelOptions {
  readonly artifacts: WorkspaceSurfaceComponent;
  readonly memory: WorkspaceSurfaceComponent;
}

const WORKSPACE_STYLE_ID = "dsh-workspace-panel-styles";

const WORKSPACE_PANEL_STYLES = `
[data-dsh-workspace="panel"] {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  color: CanvasText;
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}

[data-dsh-workspace="panel"] *,
[data-dsh-workspace="panel"] *::before,
[data-dsh-workspace="panel"] *::after {
  box-sizing: border-box;
}

[data-dsh-workspace="panel"] button,
[data-dsh-workspace="panel"] input,
[data-dsh-workspace="panel"] select,
[data-dsh-workspace="panel"] textarea {
  color: inherit;
  font: inherit;
}

[data-dsh-workspace="panel"] > summary {
  position: absolute;
  right: 16px;
  bottom: 16px;
  pointer-events: auto;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 999px;
  background: Canvas;
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  cursor: pointer;
  font-weight: 600;
  list-style: none;
}

[data-dsh-workspace="panel"] > summary::-webkit-details-marker {
  display: none;
}

[data-dsh-workspace="panel"] > summary:hover,
[data-dsh-workspace="panel"] > summary:focus-visible {
  border-color: color-mix(in srgb, CanvasText 36%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 55%, transparent);
  outline-offset: 2px;
}

[data-dsh-workspace="panel"][open] > summary {
  display: none;
}

[data-dsh-workspace="panel"] [data-dsh-workspace="drawer"] {
  position: absolute;
  top: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  width: min(440px, calc(100vw - 24px));
  min-height: 0;
  pointer-events: auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
  border-radius: 16px;
  background: Canvas;
  box-shadow: 0 18px 48px rgb(0 0 0 / 20%);
}

[data-dsh-workspace="panel-header"] {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
}

[data-dsh-workspace="panel-heading"] {
  display: grid;
  gap: 3px;
  min-width: 0;
}

[data-dsh-workspace="panel-heading"] strong {
  font-size: 15px;
  line-height: 1.3;
}

[data-dsh-workspace="panel-heading"] span {
  color: color-mix(in srgb, CanvasText 64%, transparent);
  font-size: 12px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-close"],
[data-dsh-workspace="panel-tab"] {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

[data-dsh-workspace="panel-close"] {
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  font-size: 20px;
  line-height: 1;
}

[data-dsh-workspace="panel-close"]:hover,
[data-dsh-workspace="panel-close"]:focus-visible,
[data-dsh-workspace="panel-tab"]:hover,
[data-dsh-workspace="panel-tab"]:focus-visible {
  border-color: color-mix(in srgb, CanvasText 18%, transparent);
  background: color-mix(in srgb, CanvasText 7%, transparent);
  outline: 2px solid color-mix(in srgb, Highlight 55%, transparent);
  outline-offset: 1px;
}

[data-dsh-workspace="panel-tabs"] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-artifacts:checked) [for="dsh-workspace-tab-artifacts"],
[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-memory:checked) [for="dsh-workspace-tab-memory"] {
  border-color: color-mix(in srgb, Highlight 45%, transparent);
  background: color-mix(in srgb, Highlight 14%, transparent);
  color: CanvasText;
  font-weight: 600;
}

[data-dsh-workspace="drawer"] [data-dsh-workspace="tab-content"] {
  min-width: 0;
}

[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-artifacts:checked) [data-dsh-workspace-tab="memory"],
[data-dsh-workspace="drawer"]:has(#dsh-workspace-tab-memory:checked) [data-dsh-workspace-tab="artifacts"] {
  display: none;
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
  font-size: 14px;
  line-height: 1.4;
}

[data-dsh-workspace="panel-content"] h3 {
  margin: 14px 0 6px;
  font-size: 13px;
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
  min-height: 34px;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 8px;
  background: Canvas;
}

[data-dsh-workspace="panel-content"] button {
  padding: 6px 10px;
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
  padding: 7px 9px;
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

[data-dsh-workspace="panel-content"] ul {
  display: grid;
  gap: 6px;
  max-height: 180px;
  margin: 10px 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

[data-dsh-workspace="panel-content"] li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  border-radius: 10px;
}

[data-dsh-workspace="panel-content"] li button {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-workspace="panel-content"] li span {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, CanvasText 58%, transparent);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
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

@media (max-width: 760px) {
  [data-dsh-workspace="panel"] [data-dsh-workspace="drawer"] {
    top: 8px;
    right: 8px;
    bottom: 8px;
    left: 8px;
    width: auto;
    border-radius: 14px;
  }

[data-dsh-workspace="panel"] > summary {
    right: 12px;
    bottom: 12px;
  }
}
`;

let styleUsers = 0;

export function installWorkspacePanelStyles(): () => void {
  const dom = typeof document === "object" ? document : undefined;
  if (!dom || typeof dom.getElementById !== "function" || typeof dom.createElement !== "function" || !dom.head || typeof dom.head.appendChild !== "function") return () => undefined;
  let style = dom.getElementById(WORKSPACE_STYLE_ID);
  if (!style) {
    style = dom.createElement("style");
    style.id = WORKSPACE_STYLE_ID;
    style.textContent = WORKSPACE_PANEL_STYLES;
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

export function createWorkspacePanelComponent(options: WorkspacePanelOptions): WorkspaceSurfaceComponent {
  return function WorkspacePanel(props: Record<string, unknown>): ReactNode {
    return createElement("details", { "data-dsh-workspace": "panel" },
      createElement("summary", { "aria-label": "Open Workspace" }, "Workspace"),
      createElement("aside", { id: "dsh-workspace-drawer", role: "dialog", "aria-label": "Workspace", "data-dsh-workspace": "drawer" },
        createElement("input", { id: "dsh-workspace-tab-artifacts", name: "dsh-workspace-tab", type: "radio", defaultChecked: true, "data-dsh-workspace": "tab-input", "aria-label": "Artifacts" }),
        createElement("input", { id: "dsh-workspace-tab-memory", name: "dsh-workspace-tab", type: "radio", "data-dsh-workspace": "tab-input", "aria-label": "Memory" }),
        createElement("header", { "data-dsh-workspace": "panel-header" },
          createElement("div", { "data-dsh-workspace": "panel-heading" },
            createElement("strong", null, "Workspace"),
            createElement("span", null, "Inspect artifacts and local Memory"),
          ),
          createElement("button", {
            type: "button",
            "data-dsh-workspace": "panel-close",
            "aria-label": "Close Workspace",
            onClick: (event: { readonly currentTarget: { readonly closest: (selector: string) => { readonly removeAttribute: (name: string) => void } | null } }) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
            },
          }, "×"),
        ),
        createElement("div", { role: "group", "aria-label": "Workspace sections", "data-dsh-workspace": "panel-tabs" },
          createElement("label", { htmlFor: "dsh-workspace-tab-artifacts", "data-dsh-workspace": "panel-tab" }, "Artifacts"),
          createElement("label", { htmlFor: "dsh-workspace-tab-memory", "data-dsh-workspace": "panel-tab" }, "Memory"),
        ),
        createElement("div", { "data-dsh-workspace": "panel-content" },
          createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "artifacts" }, createElement(options.artifacts, props)),
          createElement("div", { "data-dsh-workspace": "tab-content", "data-dsh-workspace-tab": "memory" }, createElement(options.memory, props)),
        ),
      ),
    );
  };
}
