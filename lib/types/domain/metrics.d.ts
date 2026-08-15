import type { WorkspaceIdentity } from "./workspace.ts";
declare const metricNames: readonly ["workspace-opened", "preview-opened", "artifact-opened", "working-set-sent", "capability-degraded"];
export type LocalMetricName = (typeof metricNames)[number];
export interface LocalMetricSnapshot {
    readonly identity: WorkspaceIdentity;
    readonly counts: Readonly<Record<LocalMetricName, number>>;
}
export interface LocalMetricRecorder {
    record(name: unknown): void;
}
export declare class LocalMetricError extends Error {
    readonly code = "INVALID_METRIC";
    constructor(message: string);
}
export declare function createLocalMetrics(identity: WorkspaceIdentity): LocalMetricRecorder & {
    snapshot(): LocalMetricSnapshot;
    reset(): void;
};
export {};
