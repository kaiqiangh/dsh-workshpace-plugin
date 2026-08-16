import { type WorkspacePath } from "../domain/path.ts";
export interface DrawerMetricRecorder {
    readonly record: (name: string) => void;
}
export type WorkspaceTab = "Files" | "Session" | "Changes" | "Context";
export type PanelStatus = "idle" | "loading" | "ready" | "empty" | "unsupported" | "error";
export type PinnedContextSourceStatus = "pending" | "ready" | "stale" | "unreadable" | "unsupported" | "oversized";
export type PinnedContextItemStatus = PinnedContextSourceStatus | "over-budget" | "capacity-unavailable";
export type PinnedContextOmissionReason = "per-item-bytes" | "context-budget" | "model-capacity" | "capacity-unavailable" | "unreadable" | "stale" | "unsupported" | "oversized";
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
export type PreviewTarget = {
    readonly type: "none";
} | {
    readonly type: "file";
    readonly path: WorkspacePath;
} | {
    readonly type: "activity";
    readonly id: string;
} | {
    readonly type: "change";
    readonly path: WorkspacePath;
};
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
export type DrawerAction = {
    readonly type: "open";
} | {
    readonly type: "close";
} | {
    readonly type: "escape";
} | {
    readonly type: "select-tab";
    readonly tab: WorkspaceTab;
} | {
    readonly type: "select-file";
    readonly path: string;
} | {
    readonly type: "select-artifact";
    readonly path: string;
} | {
    readonly type: "select-activity";
    readonly id: string;
} | {
    readonly type: "select-change";
    readonly path: string;
} | {
    readonly type: "set-working-set";
    readonly summary: WorkingSetSummary;
} | {
    readonly type: "set-pinned-context";
    readonly summary: PinnedContextSummary;
} | {
    readonly type: "set-panel";
    readonly tab: WorkspaceTab;
    readonly panel: PanelState;
} | {
    readonly type: "set-preview";
    readonly panel: PanelState;
} | {
    readonly type: "pin-working-set";
    readonly path: string;
} | {
    readonly type: "unpin-working-set";
    readonly path: string;
} | {
    readonly type: "clear-working-set";
} | {
    readonly type: "pin-context";
    readonly path: string;
} | {
    readonly type: "unpin-context";
    readonly path: string;
} | {
    readonly type: "clear-context";
} | {
    readonly type: "inspect-pinned-context";
} | {
    readonly type: "send-working-set";
};
export type DrawerEffect = "send-working-set" | "clear-working-set" | "clear-context" | "inspect-pinned-context" | {
    readonly type: "pin-working-set";
    readonly path: WorkspacePath;
} | {
    readonly type: "unpin-working-set";
    readonly path: WorkspacePath;
} | {
    readonly type: "pin-context";
    readonly path: WorkspacePath;
} | {
    readonly type: "unpin-context";
    readonly path: WorkspacePath;
};
export declare class DrawerStateError extends Error {
    readonly code: "INVALID_TAB" | "INVALID_SELECTION" | "INVALID_WORKING_SET" | "INVALID_PINNED_CONTEXT" | "INVALID_PANEL" | "INVALID_ACTION";
    constructor(code: DrawerStateError["code"], message: string);
}
export declare function createDrawerState(): DrawerState;
export declare function reduceDrawer(state: DrawerState, action: DrawerAction, metrics?: DrawerMetricRecorder): {
    state: DrawerState;
    effect?: DrawerEffect;
};
