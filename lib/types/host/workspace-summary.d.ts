import type { Context } from "@deepseek-ai/cordis";
import { WorkspaceMemoryDomain } from "../domain/memory.ts";
import { type SessionEventLike } from "./workspace-artifacts.ts";
/** Summary card payload. */
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
 * Derive a summary augmented with active-scope (session) Memory and decision
 * counts when a Memory domain is available. Pure wrapper over
 * `workspaceSummaryFor`; never writes to the session log.
 */
export declare function workspaceSummaryWithMemory(agent: SummaryAgent, memoryDomain?: WorkspaceMemoryDomain): Promise<WorkspaceSummaryData | undefined>;
/**
 * Observe final tool outcomes through the public `tools/result` seam.
 *
 * v0.6 change: this emitter NO LONGER appends a durable `workspace/summary`
 * event to the session log. Research (wayfinder #110) proved that DSH's cold
 * persistence path rejects unknown non-ignorable event types, so any session
 * whose log contains `workspace/summary` refuses to load after a restart
 * (openState=error — missing chat card and empty tab data). The summary is now
 * derived on demand from allow-listed `tool/call` + `tool/result` records via
 * `workspaceSummaryFor` / `workspaceSummaryWithMemory`, exposed to the web
 * client through the `workspaceSummary` remote. This disposer is retained for
 * API compatibility and to keep the tools/result observation seam warm; it
 * performs no log writes.
 */
export declare function attachWorkspaceSummaryEmitter(_ctx: Context, _memoryDomain?: WorkspaceMemoryDomain): () => void;
