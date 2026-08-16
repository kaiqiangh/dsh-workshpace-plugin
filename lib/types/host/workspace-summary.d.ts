import type { Context } from "@deepseek-ai/cordis";
import { WorkspaceMemoryDomain } from "../domain/memory.ts";
import { type SessionEventLike } from "./workspace-artifacts.ts";
/** Summary card payload; also carried by the durable `workspace/summary` event. */
export interface WorkspaceSummaryData {
    readonly filesTouched: number;
    readonly changes: number;
    readonly artifacts: number;
    readonly workspaceName: string;
    /** Files whose last observed activity was a create. */
    readonly filesCreated: number;
    /** Files whose last observed activity was an edit. */
    readonly filesModified: number;
    /** Files whose last observed activity was a delete. */
    readonly filesDeleted: number;
    /** Earliest observed activity timestamp in the session (0 when none). */
    readonly firstObservedAt: number;
    /** Latest observed activity timestamp in the session (0 when none). */
    readonly lastObservedAt: number;
    /** Active-scope Memory records (session scope), 0 when unavailable. */
    readonly memoryCount: number;
    /** Active-scope `decision` Memory records (session scope), 0 when unavailable. */
    readonly decisionCount: number;
}
declare module "@deepseek-ai/dsh-session/types" {
    interface SessionEventMap {
        "workspace/summary": {
            readonly id: string;
            readonly phase: "start" | "update";
            readonly summary: WorkspaceSummaryData;
        };
    }
}
/** Agent handle as observed by the tool pipeline. */
export interface SummaryAgent {
    readonly id: string;
    readonly session?: {
        readonly header?: {
            readonly cwd?: string;
        };
        readonly events?: readonly SessionEventLike[];
        readonly append?: (type: string, data: unknown) => unknown;
    };
}
/**
 * Deterministic summary from durable session tool records — never assistant
 * narration. `changes` counts present session files the agent created or
 * modified (no git dependency); `artifacts` is the session artifact count.
 */
export declare function workspaceSummaryFor(agent: SummaryAgent): WorkspaceSummaryData | undefined;
/**
 * Observe final tool outcomes through the public `tools/result` seam,
 * debounce a per-session summary, and append a durable `workspace/summary`
 * event on the owning session. When `memoryDomain` is supplied, the summary
 * is augmented with active-scope (session) Memory and decision counts. Returns
 * a disposer.
 */
export declare function attachWorkspaceSummaryEmitter(ctx: Context, memoryDomain?: WorkspaceMemoryDomain): () => void;
