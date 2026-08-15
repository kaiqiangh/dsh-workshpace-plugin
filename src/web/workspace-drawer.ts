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

export interface DrawerState {
  readonly open: boolean;
  readonly activeTab: WorkspaceTab;
  readonly selectedPath?: WorkspacePath;
  readonly selectedActivityId?: string;
  readonly selectedChangePath?: WorkspacePath;
  readonly workingSet: WorkingSetSummary;
  readonly panels: Readonly<Record<WorkspaceTab, PanelState>>;
  readonly focusReturn: "workspace-opener" | null;
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
  | { readonly type: "send-working-set" };

export class DrawerStateError extends Error {
  readonly code: "INVALID_TAB" | "INVALID_SELECTION" | "INVALID_WORKING_SET" | "INVALID_PANEL";

  constructor(code: "INVALID_TAB" | "INVALID_SELECTION" | "INVALID_WORKING_SET" | "INVALID_PANEL", message: string) {
    super(message);
    this.name = "DrawerStateError";
    this.code = code;
  }
}

const tabs: readonly WorkspaceTab[] = ["Files", "Session", "Changes"];
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
    focusReturn: null,
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
  if (panel.status === "error" && !panel.message?.trim()) {
    throw new DrawerStateError("INVALID_PANEL", "Error panels need a local message");
  }
}

export function reduceDrawer(state: DrawerState, action: DrawerAction): { state: DrawerState; effect?: "send-working-set" } {
  switch (action.type) {
    case "open":
      return { state: { ...state, open: true, focusReturn: null } };
    case "close":
    case "escape":
      return { state: { ...state, open: false, focusReturn: "workspace-opener" } };
    case "select-tab":
      assertTab(action.tab);
      return { state: { ...state, activeTab: action.tab } };
    case "select-file":
      return { state: { ...state, selectedPath: normalizeWorkspacePath(action.path) } };
    case "select-activity":
      assertSelection(action.id, "Session Activity id");
      return { state: { ...state, selectedActivityId: action.id } };
    case "select-change":
      return { state: { ...state, selectedChangePath: normalizeWorkspacePath(action.path) } };
    case "set-working-set":
      assertWorkingSet(action.summary);
      return { state: { ...state, workingSet: { ...action.summary } } };
    case "set-panel":
      assertTab(action.tab);
      assertPanel(action.panel);
      return { state: { ...state, panels: { ...state.panels, [action.tab]: { ...action.panel } } } };
    case "send-working-set":
      return { state, effect: "send-working-set" };
  }
}
