import { type ReactNode } from "react";
import type { WorkspaceSummaryData } from "../host/workspace-summary.ts";
export interface WorkspaceSummaryRemote {
    /**
     * Derive the current session summary (unwrapped value; undefined when the
     * session has no usable Workspace). v0.6 derives on demand from durable
     * tool records instead of a persisted custom event.
     */
    readonly workspaceSummary: () => Promise<WorkspaceSummaryData | undefined>;
}
export interface WorkspaceSummaryBlockOptions {
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceSummaryRemote | undefined;
    readonly remote?: WorkspaceSummaryRemote;
    readonly refreshMs?: number;
}
/** Compact human-readable session activity span derived from host timestamps. */
declare function formatActiveSpan(firstObservedAt: number, lastObservedAt: number): string;
/**
 * Read-only summary block rendered at the top of the Workspace conversation
 * tab. The data is derived on demand by the host from allow-listed durable
 * tool records (tool/call + tool/result) — never from a persisted custom
 * event — so it works identically for live and resumed sessions (the
 * history-resume fix, wayfinder #112).
 */
export declare function workspaceSummaryBlockComponent(options?: WorkspaceSummaryBlockOptions): (props: Record<string, unknown>) => ReactNode;
/** Re-export the pure span formatter for tests. */
export { formatActiveSpan };
