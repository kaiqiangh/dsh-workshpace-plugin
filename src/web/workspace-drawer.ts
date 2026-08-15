import { normalizeWorkspacePath, type WorkspacePath } from "../domain/workspace.ts";

export type WorkspaceTab = "Files" | "Session" | "Changes";
export type PanelStatus = "idle" | "loading" | "ready" | "empty" | "unsupported" | "error";

export interface PanelState {
  readonly status: PanelStatus;
  readonly message?: string;
}

export interface WorkingSetSummary {
  readonly count: number;
  readonly unresolvedCount: number;
}

export type PreviewTarget =
  | { readonly type: "none" }
  | { readonly type: "file"; readonly path: WorkspacePath }
  | { readonly type: "activity"; readonly id: string }
  | { readonly type: "change"; readonly path: WorkspacePath };

export interface DrawerState {
  readonly open: boolean;
  readonly activeTab: WorkspaceTab;
  readonly selectedPath?: WorkspacePath;
  readonly selectedActivityId?: string;
  readonly selectedChangePath?: WorkspacePath;
  readonly workingSet: WorkingSetSummary;
  readonly panels: Readonly<Record<WorkspaceTab, PanelState>>;
  readonly preview: PreviewTarget;
  readonly focusReturn: "workspace-opener" | null;
  readonly focusTrap: boolean;
  readonly focusVisible: boolean;
}

export type DrawerAction =
  | { readonly type: "open" }
  | { readonly type: "close" }
  | { readonly type: "escape" }
  | { readonly type: "select-tab"; readonly tab: WorkspaceTab }
  | { readonly type: "select-file"; readonly path: string }
  | { readonly type: "select-activity"; readonly id: string }
  | { readonly type: "select-change"; readonly path: string }
  | { readonly type: "set-working-set"; readonly summary: WorkingSetSummary }
  | { readonly type: "set-panel"; readonly tab: WorkspaceTab; readonly panel: PanelState }
  | { readonly type: "pin-working-set"; readonly path: string }
  | { readonly type: "unpin-working-set"; readonly path: string }
  | { readonly type: "clear-working-set" }
  | { readonly type: "send-working-set" };

export type DrawerEffect =
  | "send-working-set"
  | "clear-working-set"
  | { readonly type: "pin-working-set"; readonly path: WorkspacePath }
  | { readonly type: "unpin-working-set"; readonly path: WorkspacePath };

export class DrawerStateError extends Error {
  readonly code: "INVALID_TAB" | "INVALID_SELECTION" | "INVALID_WORKING_SET" | "INVALID_PANEL" | "INVALID_ACTION";

  constructor(code: "INVALID_TAB" | "INVALID_SELECTION" | "INVALID_WORKING_SET" | "INVALID_PANEL" | "INVALID_ACTION", message: string) {
    super(message);
    this.name = "DrawerStateError";
    this.code = code;
  }
}

const tabs: readonly WorkspaceTab[] = ["Files", "Session", "Changes"];
const panelStatuses: readonly PanelStatus[] = ["idle", "loading", "ready", "empty", "unsupported", "error"];
const emptyPanels = (): Record<WorkspaceTab, PanelState> => ({
  Files: { status: "idle" },
  Session: { status: "idle" },
  Changes: { status: "idle" },
});

export function createDrawerState(): DrawerState {
  return {
    open: false,
    activeTab: "Files",
    workingSet: { count: 0, unresolvedCount: 0 },
    panels: emptyPanels(),
    preview: { type: "none" },
    focusReturn: null,
    focusTrap: false,
    focusVisible: true,
  };
}

function assertTab(tab: string): asserts tab is WorkspaceTab {
  if (!tabs.includes(tab as WorkspaceTab)) {
    throw new DrawerStateError("INVALID_TAB", `Unknown Workspace tab: ${tab}`);
  }
}

function assertSelection(value: string, label: string): void {
  if (!value.trim()) throw new DrawerStateError("INVALID_SELECTION", `${label} is required`);
}

function assertWorkingSet(summary: WorkingSetSummary): void {
  if (!Number.isInteger(summary.count) || summary.count < 0 || !Number.isInteger(summary.unresolvedCount) || summary.unresolvedCount < 0 || summary.unresolvedCount > summary.count) {
    throw new DrawerStateError("INVALID_WORKING_SET", "Working Set counts must be non-negative integers");
  }
}

function assertPanel(panel: PanelState): void {
  if (!panelStatuses.includes(panel.status)) {
    throw new DrawerStateError("INVALID_PANEL", "Unknown Workspace panel status");
  }
  if (panel.status === "error" && !panel.message?.trim()) {
    throw new DrawerStateError("INVALID_PANEL", "Error panels need a local message");
  }
}

export function reduceDrawer(state: DrawerState, action: DrawerAction): { state: DrawerState; effect?: DrawerEffect } {
  switch (action.type) {
    case "open":
      return { state: { ...state, open: true, focusReturn: null, focusTrap: true, focusVisible: true } };
    case "close":
    case "escape":
      return { state: { ...state, open: false, focusReturn: "workspace-opener", focusTrap: false, focusVisible: true } };
    case "select-tab":
      assertTab(action.tab);
      return { state: { ...state, activeTab: action.tab } };
    case "select-file":
      assertSelection(action.path, "Workspace Path");
      return { state: { ...state, selectedPath: normalizeWorkspacePath(action.path), preview: { type: "file", path: normalizeWorkspacePath(action.path) } } };
    case "select-activity":
      assertSelection(action.id, "Session Activity id");
      return { state: { ...state, selectedActivityId: action.id, preview: { type: "activity", id: action.id } } };
    case "select-change":
      assertSelection(action.path, "Workspace Path");
      return { state: { ...state, selectedChangePath: normalizeWorkspacePath(action.path), preview: { type: "change", path: normalizeWorkspacePath(action.path) } } };
    case "set-working-set":
      assertWorkingSet(action.summary);
      return { state: { ...state, workingSet: { ...action.summary } } };
    case "set-panel":
      assertTab(action.tab);
      assertPanel(action.panel);
      return { state: { ...state, panels: { ...state.panels, [action.tab]: { ...action.panel } } } };
    case "pin-working-set":
      assertSelection(action.path, "Working Set Path");
      return { state, effect: { type: "pin-working-set", path: normalizeWorkspacePath(action.path) } };
    case "unpin-working-set":
      assertSelection(action.path, "Working Set Path");
      return { state, effect: { type: "unpin-working-set", path: normalizeWorkspacePath(action.path) } };
    case "clear-working-set":
      return { state, effect: "clear-working-set" };
    case "send-working-set":
      return { state, effect: "send-working-set" };
    default:
      throw new DrawerStateError("INVALID_ACTION", "Unknown Workspace drawer action");
  }
}
