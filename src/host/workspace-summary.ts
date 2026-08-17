import { basename } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import type { ToolExecution } from "@deepseek-ai/dsh-tools";

import { deriveArtifacts } from "../domain/activity.ts";
import { SessionActivityObserver } from "../domain/observation.ts";
import { resolveWorkspaceRoot, startWorkspace } from "../domain/workspace.ts";
import { WorkspaceMemoryDomain, workspaceMemoryContextFor, type MemoryHostAgent } from "../domain/memory.ts";
import { sessionToolRecords, type SessionEventLike } from "./workspace-artifacts.ts";

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
    // Retained for type-level compatibility with session logs written by
    // pre-v0.6 versions. v0.6+ never appends this event (see
    // attachWorkspaceSummaryEmitter); the summary is derived on demand.
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

/** Operational Budget: max durable tool records folded for one summary. */
export const SUMMARY_FOLD_MAX_RECORDS = 20_000;

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
  // Operational Budget guard: folding a very large session log stays bounded
  // (wayfinder #112). The most recent records dominate the summary, so a tail
  // window preserves the useful signal without unbounded resume cost.
  const records = sessionToolRecords(agent.session?.events ?? []);
  const folded = records.length > SUMMARY_FOLD_MAX_RECORDS ? records.slice(-SUMMARY_FOLD_MAX_RECORDS) : records;
  observer.resume(folded);
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
 * Derive a summary augmented with active-scope (session) Memory and decision
 * counts when a Memory domain is available. Pure wrapper over
 * `workspaceSummaryFor`; never writes to the session log.
 */
export async function workspaceSummaryWithMemory(agent: SummaryAgent, memoryDomain?: WorkspaceMemoryDomain): Promise<WorkspaceSummaryData | undefined> {
  const base = workspaceSummaryFor(agent);
  if (!base) return undefined;
  const cwd = agent.session?.header?.cwd;
  if (!memoryDomain || !cwd) return base;
  try {
    const hostAgent: MemoryHostAgent = { id: agent.id, session: { header: { cwd } } };
    const context = workspaceMemoryContextFor(hostAgent);
    const records = await memoryDomain.list(context, { scope: "session" }, { limit: 100, status: "active" });
    return Object.freeze({
      ...base,
      memoryCount: records.length,
      decisionCount: records.filter((record) => record.type === "decision").length,
    });
  } catch {
    return base;
  }
}

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
export function attachWorkspaceSummaryEmitter(_ctx: Context, _memoryDomain?: WorkspaceMemoryDomain): () => void {
  // No-op in v0.6: summary events are no longer persisted (see module doc).
  // The host service derives summaries on demand through the public remote.
  return () => {};
}
