import { basename } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import type { ToolExecution } from "@deepseek-ai/dsh-tools";

import { deriveArtifacts } from "../domain/activity.ts";
import { SessionActivityObserver } from "../domain/observation.ts";
import { resolveWorkspaceRoot, startWorkspace } from "../domain/workspace.ts";
import { sessionToolRecords, type SessionEventLike } from "./workspace-artifacts.ts";

/** Summary card payload; also carried by the durable `workspace/summary` event. */
export interface WorkspaceSummaryData {
  readonly filesTouched: number;
  readonly changes: number;
  readonly artifacts: number;
  readonly workspaceName: string;
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
  return Object.freeze({
    filesTouched: files.length,
    changes,
    artifacts: deriveArtifacts(observer.projection).length,
    workspaceName: basename(root),
  });
}

/**
 * Observe final tool outcomes through the public `tools/result` seam,
 * debounce a per-session summary, and append a durable `workspace/summary`
 * event on the owning session. Returns a disposer.
 */
export function attachWorkspaceSummaryEmitter(ctx: Context): () => void {
  const emitted = new Set<string>();
  const pending = new Map<string, SummaryAgent>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (agent: SummaryAgent): void => {
    timers.delete(agent.id);
    const summary = workspaceSummaryFor(agent);
    if (!summary) return;
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
    timers.set(agent.id, setTimeout(() => flush(pending.get(agent.id)!), SUMMARY_DEBOUNCE_MS));
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
