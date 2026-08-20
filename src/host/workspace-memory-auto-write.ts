import { createHash } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import type { ToolExecution } from "@deepseek-ai/dsh-tools";

import { deriveArtifacts, type ArtifactProjection, type SessionFileProjection } from "../domain/activity.ts";
import { SessionActivityObserver, type NativeDurableToolRecord } from "../domain/observation.ts";
import { WorkspaceMemoryDomain, workspaceMemoryContextFor } from "../domain/memory.ts";
import { memoryRetentionForScope } from "../domain/memory-governance.ts";
import type { MemoryDraft, MemorySourceRef } from "../domain/memory-store.ts";
import { sessionToolRecords, type SessionEventLike } from "./workspace-artifacts.ts";

/** Debounce window for one session's auto-fact digest write. */
const AUTO_WRITE_DEBOUNCE_MS = 500;

/** Fixed title so the session surface groups auto facts as one stable digest family. */
export const AUTO_FACT_TITLE = "Session workspace digest (auto)";

/** Tags attached to every auto-captured fact record. */
export const AUTO_FACT_TAGS: readonly string[] = ["auto", "workspace"];

/** Maximum number of distinct auto-fact digests kept per session before pruning. */
const MAX_AUTO_FACTS_PER_SESSION = 6;

/** Agent handle as observed by the tool pipeline (subset of the session seam). */
export interface AutoWriteAgent {
  readonly id: string;
  readonly session?: {
    readonly header?: { readonly cwd?: string };
    readonly events?: readonly SessionEventLike[];
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Deterministic digest key over the fact payload (paths by kind + artifacts). */
function digestKeyFor(created: readonly string[], modified: readonly string[], deleted: readonly string[], artifacts: readonly string[]): string {
  return sha256Hex(JSON.stringify({ created, modified, deleted, artifacts })).slice(0, 24);
}

function latestEventSeq(records: readonly NativeDurableToolRecord[]): number | undefined {
  const seq = records.reduce((max, record) => Math.max(max, record.seq), 0);
  return seq > 0 ? seq : undefined;
}

/**
 * Build a compact, human-readable fact digest from the durable session
 * projection. Deliberately deterministic for a given digest key so repeated
 * flushes of unchanged activity merge into the same record instead of piling
 * up. Only relative Workspace paths are included — never absolute host paths.
 */
export function buildAutoFactContent(
  touched: readonly SessionFileProjection[],
  artifacts: readonly ArtifactProjection[],
): string {
  const created = touched.filter((file) => file.lastKind === "CREATED").map((file) => file.path);
  const modified = touched.filter((file) => file.lastKind === "MODIFIED").map((file) => file.path);
  const deleted = touched.filter((file) => file.lastKind === "DELETED").map((file) => file.path);
  const artifactPaths = artifacts.map((artifact) => artifact.path).sort((left, right) => left.localeCompare(right));
  const lines: string[] = [
    `Files touched: ${touched.length} (${created.length} created, ${modified.length} modified, ${deleted.length} deleted).`,
  ];
  if (created.length > 0) lines.push(`Created: ${created.join(", ")}`);
  if (modified.length > 0) lines.push(`Modified: ${modified.join(", ")}`);
  if (deleted.length > 0) lines.push(`Deleted: ${deleted.join(", ")}`);
  lines.push(`Artifacts: ${artifactPaths.length}${artifactPaths.length > 0 ? ` — ${artifactPaths.join(", ")}` : ""}.`);
  return lines.join("\n");
}

/**
 * Derive one stable-id `session`-scope `fact` Memory record from the durable
 * tool records of a session. The record is governed as `derived` /
 * `unverified` (never injected into Agent/model context) and updated in place
 * for repeated identical digests. Returns the written record id, or undefined
 * when there is nothing useful to capture.
 */
export async function writeAutoFact(
  memoryDomain: WorkspaceMemoryDomain,
  agent: AutoWriteAgent,
): Promise<string | undefined> {
  const cwd = agent.session?.header?.cwd;
  if (typeof agent.id !== "string" || !agent.id.trim() || !cwd) return undefined;
  const { identity, root, snapshot } = workspaceMemoryContextFor(agent);
  const request = { scope: "session" as const };
  const context = { identity, root };
  const records = sessionToolRecords(agent.session?.events ?? [], root);
  const observer = new SessionActivityObserver(identity, snapshot.baseline);
  observer.resume(records);
  const files = [...observer.projection.files.values()];
  const touched = files.filter((file) =>
    file.lastKind === "CREATED" || file.lastKind === "MODIFIED" || file.lastKind === "DELETED");
  const artifacts = deriveArtifacts(observer.projection);
  if (touched.length === 0 && artifacts.length === 0) return undefined;

  const created = touched.filter((file) => file.lastKind === "CREATED").map((file) => file.path);
  const modified = touched.filter((file) => file.lastKind === "MODIFIED").map((file) => file.path);
  const deleted = touched.filter((file) => file.lastKind === "DELETED").map((file) => file.path);
  const content = buildAutoFactContent(touched, artifacts);
  const scopeKey = `${identity.sessionId}|${identity.rootId}`;
  const digestKey = digestKeyFor(created, modified, deleted, artifacts.map((artifact) => artifact.path));
  const stableId = `memory:auto:fact:${sha256Hex(scopeKey).slice(0, 16)}:${digestKey}`;

  const state = await memoryDomain.open(context, request);
  // Only hand the stable id to a brand-new digest. When the same digest is
  // observed again, upsert without an id so MemoryStore merges source refs by
  // (type + contentHash) instead of bumping an expected revision (which would
  // race between debounced flushes and fail closed).
  const existing = state.records.some((record) => record.id === stableId);
  const eventSeq = latestEventSeq(records);
  const sourceRefs: MemorySourceRef[] = [{ kind: "session", id: agent.id }];
  if (eventSeq !== undefined) sourceRefs.push({ kind: "event", id: String(eventSeq) });
  const draft: MemoryDraft = {
    scope: state.scope,
    scopeKey: state.scopeKey,
    type: "fact",
    title: AUTO_FACT_TITLE,
    content,
    tags: AUTO_FACT_TAGS,
    ...(existing ? {} : { id: stableId }),
    provenance: {
      kind: "tool",
      sessionId: agent.id,
      ...(eventSeq === undefined ? {} : { eventSeq }),
      note: "workspace auto-writer",
    },
    governance: {
      origin: "derived",
      sourceRefs,
      verification: "unverified",
      revision: 1,
      retention: memoryRetentionForScope(state.scope),
    },
  };
  const written = await memoryDomain.upsert(context, request, draft);

  // Keep the session surface tidy: archive the oldest auto-fact digests beyond
  // a small bound. Archived records remain inspectable via the archive filter.
  const autoPrefix = `memory:auto:fact:${sha256Hex(scopeKey).slice(0, 16)}:`;
  const autoFacts = state.records.filter((record) => record.id.startsWith(autoPrefix) && record.status === "active");
  const stale = autoFacts
    .filter((record) => record.id !== written.id)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(MAX_AUTO_FACTS_PER_SESSION - 1);
  for (const record of stale) {
    try { await memoryDomain.archive(context, request, record.id); } catch { /* best-effort pruning */ }
  }
  return written.id;
}

/**
 * Host-side Memory auto-writer. Observes the existing `tools/result` seam,
 * debounces per session, derives a structured session digest, and upserts a
 * governed `unverified` `session`-scope `fact` record (stable id, updated in
 * place) so Memory exports carry useful information. No Agent/model context is
 * touched; the governance model is unchanged. Returns a disposer.
 */
export function attachWorkspaceMemoryAutoWriter(ctx: Context, memoryDomain?: WorkspaceMemoryDomain): () => void {
  const pending = new Map<string, AutoWriteAgent>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = async (agent: AutoWriteAgent): Promise<void> => {
    timers.delete(agent.id);
    if (!memoryDomain) return;
    try {
      await writeAutoFact(memoryDomain, agent);
    } catch {
      // Auto-write is best-effort; storage or identity failures must never
      // break the tool pipeline.
    }
  };

  const onToolResult = (exec: ToolExecution): undefined => {
    if (!memoryDomain) return undefined;
    const agent = exec.agent as AutoWriteAgent | undefined;
    if (!agent?.session) return undefined;
    pending.set(agent.id, agent);
    const existing = timers.get(agent.id);
    if (existing !== undefined) clearTimeout(existing);
    timers.set(agent.id, setTimeout(() => { void flush(pending.get(agent.id)!).catch(() => {}); }, AUTO_WRITE_DEBOUNCE_MS));
    return undefined;
  };

  ctx.on("tools/result", onToolResult);
  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pending.clear();
  };
}
