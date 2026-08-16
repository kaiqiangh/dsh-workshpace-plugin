import { normalizeWorkspacePath, type WorkspacePath } from "../domain/path.ts";

export interface DrawerMetricRecorder {
  readonly record: (name: string) => void;
}

export type WorkspaceTab = "Files" | "Session" | "Changes" | "Context";
export type PanelStatus = "idle" | "loading" | "ready" | "empty" | "unsupported" | "error";

export type PinnedContextSourceStatus = "pending" | "ready" | "stale" | "unreadable" | "unsupported" | "oversized";
export type PinnedContextItemStatus = PinnedContextSourceStatus | "over-budget" | "capacity-unavailable";
export type PinnedContextOmissionReason =
  | "per-item-bytes"
  | "context-budget"
  | "model-capacity"
  | "capacity-unavailable"
  | "unreadable"
  | "stale"
  | "unsupported"
  | "oversized";

export interface PinnedContextItemMetadata {
  readonly path: WorkspacePath;
  readonly order: number;
  readonly sourceStatus: PinnedContextSourceStatus;
  readonly status: PinnedContextItemStatus;
  readonly contentHash?: string;
  readonly bytes?: number;
  readonly estimatedTokens?: number;
  readonly loadedAt?: number;
  readonly omissionReason?: PinnedContextOmissionReason;
  readonly reason?: string;
}

export interface PinnedContextSummary {
  readonly count: number;
  readonly capacity: "available" | "unavailable";
  readonly capacityTokens?: number;
  readonly admittedTokens: number;
  readonly availableBudgetTokens: number;
  readonly remainingTokens: number;
  readonly entries: readonly PinnedContextItemMetadata[];
}

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

export interface PreviewState {
  readonly target: PreviewTarget;
  readonly status: PanelStatus;
  readonly message?: string;
}

export interface DrawerState {
  readonly open: boolean;
  readonly activeTab: WorkspaceTab;
  readonly selectedPath?: WorkspacePath;
  readonly selectedActivityId?: string;
  readonly selectedChangePath?: WorkspacePath;
  readonly workingSet: WorkingSetSummary;
  readonly pinnedContext: PinnedContextSummary;
  readonly panels: Readonly<Record<WorkspaceTab, PanelState>>;
  readonly preview: PreviewState;
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
  | { readonly type: "select-artifact"; readonly path: string }
  | { readonly type: "select-activity"; readonly id: string }
  | { readonly type: "select-change"; readonly path: string }
  | { readonly type: "set-working-set"; readonly summary: WorkingSetSummary }
  | { readonly type: "set-pinned-context"; readonly summary: PinnedContextSummary }
  | { readonly type: "set-panel"; readonly tab: WorkspaceTab; readonly panel: PanelState }
  | { readonly type: "set-preview"; readonly panel: PanelState }
  | { readonly type: "pin-working-set"; readonly path: string }
  | { readonly type: "unpin-working-set"; readonly path: string }
  | { readonly type: "clear-working-set" }
  | { readonly type: "pin-context"; readonly path: string }
  | { readonly type: "unpin-context"; readonly path: string }
  | { readonly type: "clear-context" }
  | { readonly type: "inspect-pinned-context" }
  | { readonly type: "send-working-set" };

export type DrawerEffect =
  | "send-working-set"
  | "clear-working-set"
  | "clear-context"
  | "inspect-pinned-context"
  | { readonly type: "pin-working-set"; readonly path: WorkspacePath }
  | { readonly type: "unpin-working-set"; readonly path: WorkspacePath }
  | { readonly type: "pin-context"; readonly path: WorkspacePath }
  | { readonly type: "unpin-context"; readonly path: WorkspacePath };

export class DrawerStateError extends Error {
  readonly code: "INVALID_TAB" | "INVALID_SELECTION" | "INVALID_WORKING_SET" | "INVALID_PINNED_CONTEXT" | "INVALID_PANEL" | "INVALID_ACTION";

  constructor(code: DrawerStateError["code"], message: string) {
    super(message);
    this.name = "DrawerStateError";
    this.code = code;
  }
}

const tabs: readonly WorkspaceTab[] = ["Files", "Session", "Changes", "Context"];
const panelStatuses: readonly PanelStatus[] = ["idle", "loading", "ready", "empty", "unsupported", "error"];
const pinnedSourceStatuses: readonly PinnedContextSourceStatus[] = ["pending", "ready", "stale", "unreadable", "unsupported", "oversized"];
const pinnedStatuses: readonly PinnedContextItemStatus[] = [...pinnedSourceStatuses, "over-budget", "capacity-unavailable"];
const pinnedOmissionReasons: readonly PinnedContextOmissionReason[] = ["per-item-bytes", "context-budget", "model-capacity", "capacity-unavailable", "unreadable", "stale", "unsupported", "oversized"];
const emptyPanels = (): Record<WorkspaceTab, PanelState> => ({
  Files: { status: "idle" },
  Session: { status: "idle" },
  Changes: { status: "idle" },
  Context: { status: "idle" },
});

const emptyPinnedContext = (): PinnedContextSummary => ({
  count: 0,
  capacity: "unavailable",
  admittedTokens: 0,
  availableBudgetTokens: 0,
  remainingTokens: 0,
  entries: [],
});

export function createDrawerState(): DrawerState {
  return {
    open: false,
    activeTab: "Files",
    workingSet: { count: 0, unresolvedCount: 0 },
    pinnedContext: emptyPinnedContext(),
    panels: emptyPanels(),
    preview: { target: { type: "none" }, status: "idle" },
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
  if (typeof value !== "string" || !value.trim()) throw new DrawerStateError("INVALID_SELECTION", `${label} is required`);
}

function normalizedSelectionPath(input: string, label: string): WorkspacePath {
  assertSelection(input, label);
  const path = normalizeWorkspacePath(input);
  if (!path) throw new DrawerStateError("INVALID_SELECTION", `${label} is required`);
  return path;
}

function assertWorkingSet(summary: WorkingSetSummary): void {
  if (!summary || typeof summary !== "object" || !Number.isInteger(summary.count) || summary.count < 0 || !Number.isInteger(summary.unresolvedCount) || summary.unresolvedCount < 0 || summary.unresolvedCount > summary.count) {
    throw new DrawerStateError("INVALID_WORKING_SET", "Working Set counts must be non-negative integers");
  }
}

function normalizePinnedContext(summary: PinnedContextSummary): PinnedContextSummary {
  if (!summary || typeof summary !== "object" || !Number.isSafeInteger(summary.count) || summary.count < 0
    || !Number.isSafeInteger(summary.admittedTokens) || summary.admittedTokens < 0
    || !Number.isSafeInteger(summary.availableBudgetTokens) || summary.availableBudgetTokens < 0
    || !Number.isSafeInteger(summary.remainingTokens) || summary.remainingTokens < 0
    || (summary.capacity !== "available" && summary.capacity !== "unavailable")
    || !Array.isArray(summary.entries) || summary.entries.length !== summary.count
    || (summary.capacityTokens !== undefined && (!Number.isSafeInteger(summary.capacityTokens) || summary.capacityTokens <= 0))) {
    throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context summary is invalid");
  }
  const entries = summary.entries.map((entry) => {
    if (!entry || typeof entry !== "object" || !Number.isSafeInteger(entry.order) || entry.order < 0
      || typeof entry.path !== "string" || !entry.path || !pinnedSourceStatuses.includes(entry.sourceStatus)
      || !pinnedStatuses.includes(entry.status)
      || (entry.contentHash !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(entry.contentHash))
      || (entry.bytes !== undefined && (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0))
      || (entry.estimatedTokens !== undefined && (!Number.isSafeInteger(entry.estimatedTokens) || entry.estimatedTokens < 0))
      || (entry.loadedAt !== undefined && (!Number.isSafeInteger(entry.loadedAt) || entry.loadedAt < 0))
      || (entry.omissionReason !== undefined && !pinnedOmissionReasons.includes(entry.omissionReason))
      || (entry.reason !== undefined && (typeof entry.reason !== "string" || /[\u0000-\u001f\u007f]/u.test(entry.reason)))) {
      throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context entry metadata is invalid");
    }
    let path: WorkspacePath;
    try {
      path = normalizeWorkspacePath(entry.path);
    } catch {
      throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context paths must be normalized and relative");
    }
    if (!path || path !== entry.path || /[\u0000-\u001f\u007f]/u.test(path)) {
      throw new DrawerStateError("INVALID_PINNED_CONTEXT", "Pinned Context paths must be normalized and relative");
    }
    return Object.freeze({
      path,
      order: entry.order,
      sourceStatus: entry.sourceStatus,
      status: entry.status,
      ...(entry.contentHash === undefined ? {} : { contentHash: entry.contentHash }),
      ...(entry.bytes === undefined ? {} : { bytes: entry.bytes }),
      ...(entry.estimatedTokens === undefined ? {} : { estimatedTokens: entry.estimatedTokens }),
      ...(entry.loadedAt === undefined ? {} : { loadedAt: entry.loadedAt }),
      ...(entry.omissionReason === undefined ? {} : { omissionReason: entry.omissionReason }),
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
    });
  });
  return Object.freeze({
    count: summary.count,
    capacity: summary.capacity,
    ...(summary.capacityTokens === undefined ? {} : { capacityTokens: summary.capacityTokens }),
    admittedTokens: summary.admittedTokens,
    availableBudgetTokens: summary.availableBudgetTokens,
    remainingTokens: summary.remainingTokens,
    entries: Object.freeze(entries),
  });
}

function assertPanel(panel: PanelState): void {
  if (!panel || typeof panel !== "object" || !panelStatuses.includes(panel.status)) {
    throw new DrawerStateError("INVALID_PANEL", "Unknown Workspace panel status");
  }
  if (panel.message !== undefined && typeof panel.message !== "string") {
    throw new DrawerStateError("INVALID_PANEL", "Panel messages must be strings");
  }
  if (panel.status === "error" && !panel.message?.trim()) {
    throw new DrawerStateError("INVALID_PANEL", "Error panels need a local message");
  }
}

function recordMetric(metrics: DrawerMetricRecorder | undefined, name: string): void {
  metrics?.record(name);
}

export function reduceDrawer(state: DrawerState, action: DrawerAction, metrics?: DrawerMetricRecorder): { state: DrawerState; effect?: DrawerEffect } {
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new DrawerStateError("INVALID_ACTION", "Unknown Workspace drawer action");
  }

  switch (action.type) {
    case "open":
      recordMetric(metrics, "workspace-opened");
      return { state: { ...state, open: true, focusReturn: null, focusTrap: true, focusVisible: true } };
    case "close":
    case "escape":
      return { state: { ...state, open: false, focusReturn: "workspace-opener", focusTrap: false, focusVisible: true } };
    case "select-tab":
      assertTab(action.tab);
      return { state: { ...state, activeTab: action.tab } };
    case "select-file":
      {
        const path = normalizedSelectionPath(action.path, "Workspace Path");
        recordMetric(metrics, "preview-opened");
        return { state: { ...state, selectedPath: path, preview: { target: { type: "file", path }, status: "loading" } } };
      }
    case "select-artifact":
      {
        const path = normalizedSelectionPath(action.path, "Artifact Path");
        recordMetric(metrics, "artifact-opened");
        return { state: { ...state, selectedPath: path, preview: { target: { type: "file", path }, status: "loading" } } };
      }
    case "select-activity":
      assertSelection(action.id, "Session Activity id");
      recordMetric(metrics, "preview-opened");
      return { state: { ...state, selectedActivityId: action.id, preview: { target: { type: "activity", id: action.id }, status: "loading" } } };
    case "select-change":
      {
        const path = normalizedSelectionPath(action.path, "Workspace Path");
        recordMetric(metrics, "preview-opened");
        return { state: { ...state, selectedChangePath: path, preview: { target: { type: "change", path }, status: "loading" } } };
      }
    case "set-working-set":
      assertWorkingSet(action.summary);
      return { state: { ...state, workingSet: { ...action.summary } } };
    case "set-pinned-context":
      return { state: { ...state, pinnedContext: normalizePinnedContext(action.summary) } };
    case "set-panel":
      assertTab(action.tab);
      assertPanel(action.panel);
      if (action.panel.status === "error" || action.panel.status === "unsupported") recordMetric(metrics, "capability-degraded");
      return { state: { ...state, panels: { ...state.panels, [action.tab]: { ...action.panel } } } };
    case "set-preview":
      assertPanel(action.panel);
      if (action.panel.status === "error" || action.panel.status === "unsupported") recordMetric(metrics, "capability-degraded");
      return { state: { ...state, preview: { target: state.preview.target, ...action.panel } } };
    case "pin-working-set":
      return { state, effect: { type: "pin-working-set", path: normalizedSelectionPath(action.path, "Working Set Path") } };
    case "unpin-working-set":
      return { state, effect: { type: "unpin-working-set", path: normalizedSelectionPath(action.path, "Working Set Path") } };
    case "clear-working-set":
      return { state, effect: "clear-working-set" };
    case "pin-context":
      return { state, effect: { type: "pin-context", path: normalizedSelectionPath(action.path, "Pinned Context Path") } };
    case "unpin-context":
      return { state, effect: { type: "unpin-context", path: normalizedSelectionPath(action.path, "Pinned Context Path") } };
    case "clear-context":
      return { state, effect: "clear-context" };
    case "inspect-pinned-context":
      recordMetric(metrics, "pinned-context-inspected");
      return { state, effect: "inspect-pinned-context" };
    case "send-working-set":
      recordMetric(metrics, "working-set-sent");
      return { state, effect: "send-working-set" };
    default:
      throw new DrawerStateError("INVALID_ACTION", "Unknown Workspace drawer action");
  }
}
