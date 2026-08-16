import { basename } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import type { ToolExecution } from "@deepseek-ai/dsh-tools";

import { deriveArtifacts } from "../domain/activity.ts";
import { SessionActivityObserver } from "../domain/observation.ts";
import { resolveWorkspaceRoot, startWorkspace } from "../domain/workspace.ts";
import { WorkspaceMemoryDomain, workspaceMemoryContextFor, type MemoryHostAgent } from "../domain/memory.ts";
import { sessionToolRecords, type SessionEventLike } from "./workspace-artifacts.ts";

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
    "workspace/summary": { readonly id: string; readonly phase: "start" | "update"; readonly summary: WorkspaceSummaryData };
  }
}

/** Agent handle as observed by the tool pipeline. */
export interface SummaryAgent {
  readonly id: string;
  readonly session?: {
    readonly header?: { readonly cwd?: string };
    readonly events?: readonly SessionEventLike[];
    readonly append?: (type: string, data: unknown) => unknown;
  };
}

const SUMMARY_DEBOUNCE_MS = 300;

/**
 * Deterministic summary from durable session tool records — never assistant
 * narration. `changes` counts present session files the agent created or
 * modified (no git dependency); `artifacts` is the session artifact count.
 */
export function workspaceSummaryFor(agent: SummaryAgent): WorkspaceSummaryData | undefined {
  const cwd = agent.session?.header?.cwd;
  if (typeof agent.id !== "string" || !agent.id.trim() || !cwd) return undefined;
  let identity: ReturnType<typeof startWorkspace>["identity"];
  let root: string;
  let baseline: ReturnType<typeof startWorkspace>["baseline"];
  try {
    const snapshot = startWorkspace({ sessionId: agent.id, processCwd: cwd });
    identity = snapshot.identity;
    baseline = snapshot.baseline;
    root = resolveWorkspaceRoot(cwd, ".");
  } catch {
    return undefined;
  }
  const observer = new SessionActivityObserver(identity, baseline);
  observer.resume(sessionToolRecords(agent.session?.events ?? []));
  const files = [...observer.projection.files.values()];
  const changes = files.filter((file) =>
    file.current === "present"
    && (file.lastKind === "CREATED" || file.lastKind === "MODIFIED")
    && (file.attribution === "agent-evidenced" || file.attribution === "session-observed")).length;
  const filesCreated = files.filter((file) => file.lastKind === "CREATED").length;
  const filesModified = files.filter((file) => file.lastKind === "MODIFIED").length;
  const filesDeleted = files.filter((file) => file.lastKind === "DELETED").length;
  const observedAts = files.flatMap((file) => [file.firstObservedAt, file.lastObservedAt]);
  const firstObservedAt = observedAts.length ? Math.min(...observedAts) : 0;
  const lastObservedAt = observedAts.length ? Math.max(...observedAts) : 0;
  return Object.freeze({
    filesTouched: files.length,
    changes,
    artifacts: deriveArtifacts(observer.projection).length,
    workspaceName: basename(root),
    filesCreated,
    filesModified,
    filesDeleted,
    firstObservedAt,
    lastObservedAt,
    // Memory/decision counts are attached by the emitter when a Memory domain
    // is available; the pure summary defaults them to 0 so the payload shape
    // is always complete and the web card can render without a host seam.
    memoryCount: 0,
    decisionCount: 0,
  });
}

/**
 * Observe final tool outcomes through the public `tools/result` seam,
 * debounce a per-session summary, and append a durable `workspace/summary`
 * event on the owning session. When `memoryDomain` is supplied, the summary
 * is augmented with active-scope (session) Memory and decision counts. Returns
 * a disposer.
 */
export function attachWorkspaceSummaryEmitter(ctx: Context, memoryDomain?: WorkspaceMemoryDomain): () => void {
  const emitted = new Set<string>();
  const pending = new Map<string, SummaryAgent>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const withMemoryCounts = async (agent: SummaryAgent, base: WorkspaceSummaryData): Promise<WorkspaceSummaryData> => {
    const cwd = agent.session?.header?.cwd;
    if (!cwd) return base;
    try {
      const hostAgent: MemoryHostAgent = { id: agent.id, session: { header: { cwd } } };
      const context = workspaceMemoryContextFor(hostAgent);
      const records = await memoryDomain!.list(context, { scope: "session" }, { limit: 100, status: "active" });
      return Object.freeze({
        ...base,
        memoryCount: records.length,
        decisionCount: records.filter((record) => record.type === "decision").length,
      });
    } catch {
      return base;
    }
  };

  const flush = async (agent: SummaryAgent): Promise<void> => {
    timers.delete(agent.id);
    const base = workspaceSummaryFor(agent);
    if (!base) return;
    const summary = memoryDomain ? await withMemoryCounts(agent, base) : base;
    const phase = emitted.has(agent.id) ? "update" : "start";
    emitted.add(agent.id);
    agent.session?.append?.("workspace/summary", { id: agent.id, phase, summary });
  };

  const onToolResult = (exec: ToolExecution): undefined => {
    const agent = exec.agent as SummaryAgent | undefined;
    if (!agent?.session) return undefined;
    pending.set(agent.id, agent);
    const existing = timers.get(agent.id);
    if (existing !== undefined) clearTimeout(existing);
    timers.set(agent.id, setTimeout(() => { void flush(pending.get(agent.id)!).catch(() => {}); }, SUMMARY_DEBOUNCE_MS));
    return undefined;
  };

  ctx.on("tools/result", onToolResult);
  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pending.clear();
    emitted.clear();
  };
}
