import type { ActivityAttribution, ActivityKind, ActivityObservation, ActivityProjection, ActivitySource } from "./activity.ts";
import type { SessionBaseline, WorkspaceIdentity, WorkspacePath } from "./workspace.ts";
export interface LiveToolOutcome {
    readonly identity: WorkspaceIdentity;
    readonly callId: string;
    readonly rootCallId?: string;
    readonly tool: string;
    readonly arguments?: unknown;
    readonly result?: unknown;
    readonly ok?: boolean;
    readonly background?: boolean;
    readonly settled?: boolean;
    readonly observedAt: number;
    readonly eventSeq?: number;
    readonly source?: Extract<ActivitySource, "live-tool" | "durable-tool">;
    readonly potentiallyMutating?: boolean;
}
export interface ReconciliationRequest {
    readonly id: string;
    readonly debounceKey: string;
    readonly identity: WorkspaceIdentity;
    readonly callId: string;
    readonly rootCallId?: string;
    readonly observedAt: number;
    readonly reason: "potentially-mutating" | "failed-call" | "background-settled";
}
export interface ObservationBatch {
    readonly observations: readonly ActivityObservation[];
    readonly reconciliation?: ReconciliationRequest;
}
export interface ReconciliationEntry {
    readonly path: WorkspacePath | string;
    readonly previousPath?: WorkspacePath | string;
    readonly status?: string;
    readonly kind?: ActivityKind;
    readonly exists?: boolean;
    readonly previewable?: boolean;
}
export interface ReconciliationSnapshot {
    readonly id: string;
    readonly source: Extract<ActivitySource, "git" | "filesystem">;
    readonly observedAt: number;
    readonly entries: readonly ReconciliationEntry[];
}
export interface NativeDurableToolRecord {
    readonly seq: number;
    readonly time?: number;
    readonly type: string;
    readonly data?: Record<string, unknown>;
    readonly [key: string]: unknown;
}
export interface ActivitySummary {
    readonly path: WorkspacePath;
    readonly occurrences: number;
    readonly firstObservedAt: number;
    readonly lastObservedAt: number;
    readonly current: "present" | "deleted" | "unknown";
    readonly attribution: ActivityAttribution;
}
export declare function classifyToolOutcome(outcome: LiveToolOutcome): readonly ActivityObservation[];
export declare function reconciliationFor(outcome: LiveToolOutcome): ReconciliationRequest | undefined;
export declare function observeLiveTool(outcome: LiveToolOutcome): ObservationBatch;
export declare function reconcileSnapshot(identity: WorkspaceIdentity, baseline: SessionBaseline, snapshot: ReconciliationSnapshot): readonly ActivityObservation[];
export declare function summarizeActivity(projection: ActivityProjection): readonly ActivitySummary[];
export declare class DebouncedReconciliationQueue {
    private readonly pendingByKey;
    private timer;
    private readonly delayMs;
    private readonly onFlush;
    constructor(delayMs?: number, onFlush?: (requests: readonly ReconciliationRequest[]) => void);
    request(request: ReconciliationRequest): void;
    pending(): readonly ReconciliationRequest[];
    flush(): readonly ReconciliationRequest[];
    dispose(): void;
}
export declare class SessionActivityObserver {
    private projectionState;
    private replayed;
    private readonly liveKeys;
    private readonly durableCallKeys;
    readonly identity: WorkspaceIdentity;
    readonly baseline: SessionBaseline;
    readonly reconciliations: DebouncedReconciliationQueue;
    constructor(identity: WorkspaceIdentity, baseline: SessionBaseline, reconciliationQueue?: DebouncedReconciliationQueue);
    get projection(): ActivityProjection;
    resume(records: readonly NativeDurableToolRecord[]): ActivityProjection;
    consumeLive(outcome: LiveToolOutcome): ObservationBatch;
    applyReconciliation(snapshot: ReconciliationSnapshot): ActivityProjection;
    dispose(): void;
    private applyBatch;
}
