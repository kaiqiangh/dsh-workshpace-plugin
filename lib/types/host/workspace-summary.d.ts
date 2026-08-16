import type { Context } from "@deepseek-ai/cordis";
import { type SessionEventLike } from "./workspace-artifacts.ts";
/** Summary card payload; also carried by the durable `workspace/summary` event. */
export interface WorkspaceSummaryData {
    readonly filesTouched: number;
    readonly changes: number;
    readonly artifacts: number;
    readonly workspaceName: string;
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
 * event on the owning session. Returns a disposer.
 */
export declare function attachWorkspaceSummaryEmitter(ctx: Context): () => void;
