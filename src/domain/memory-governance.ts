import { createHash, randomUUID } from "node:crypto";

import {
  hashMemoryContent,
  MEMORY_MAX_FILE_BYTES,
  MEMORY_MAX_TAGS,
  MEMORY_SCHEMA_VERSION,
  type MemoryGovernance,
  type MemoryContentHash,
  type MemoryOrigin,
  type MemoryRecord,
  type MemoryRetention,
  type MemoryScope,
  type MemorySourceRef,
  type MemoryType,
  type MemoryVerification,
} from "./memory-store.ts";
import { MEMORY_TYPES } from "../types.ts";

export const MEMORY_MAX_IMPORT_RECORDS = 10_000;

export type MemoryGovernanceAction = "verify" | "reject" | "reverify" | "pin" | "unpin" | "archive" | "restore" | "stale" | "forget";

export type MemoryGovernanceErrorCode = "INVALID_TRANSITION" | "UNAUTHORIZED" | "CONFLICT" | "INELIGIBLE" | "INVALID_SOURCE";

export class MemoryGovernanceError extends Error {
  readonly code: MemoryGovernanceErrorCode;
  readonly conflict?: MemoryRevisionConflict;

  constructor(code: MemoryGovernanceErrorCode, message: string, conflict?: MemoryRevisionConflict) {
    super(message);
    this.name = "MemoryGovernanceError";
    this.code = code;
    this.conflict = conflict;
  }
}

export interface MemoryRevisionConflict {
  readonly code: "CONFLICT";
  readonly id: string;
  readonly currentRevision: number;
  readonly currentHash: string;
  readonly expectedRevision: number;
  readonly expectedHash: string;
}

const originFor = (record: MemoryRecord): MemoryOrigin => record.provenance.kind === "user" ? "user-authored" : record.provenance.kind === "import" ? "imported" : record.provenance.kind === "agent" ? "derived" : "derived";
export const memoryRetentionForScope = (scope: MemoryRecord["scope"]): MemoryRetention => scope === "session" ? "session-end" : scope === "user" ? "user-managed" : "project-delete";

export function memoryGovernance(record: MemoryRecord): MemoryGovernance {
  return record.governance ?? {
    origin: originFor(record),
    sourceRefs: record.provenance.kind === "user" ? [] : [sourceRef(record.provenance.kind === "import" ? "import" : "session", record.provenance.sessionId ?? record.id)],
    verification: record.provenance.kind === "user" ? "verified" : "unverified",
    ...(record.provenance.kind === "user" ? { verifiedAt: record.updatedAt, verifiedBy: "user" as const } : {}),
    revision: 1,
    retention: memoryRetentionForScope(record.scope),
  };
}

export function memoryGovernanceEligible(record: MemoryRecord, now = Date.now()): boolean {
  const governance = memoryGovernance(record);
  return record.status === "active" && governance.verification === "verified" && (governance.expiresAt === undefined || governance.expiresAt > now);
}

export function assertMemoryRevision(record: MemoryRecord, expectedRevision: number, expectedHash: string): void {
  const governance = memoryGovernance(record);
  if (governance.revision !== expectedRevision || record.contentHash !== expectedHash) {
    throw new MemoryGovernanceError("CONFLICT", `Memory ${record.id} changed before this edit`, {
      code: "CONFLICT",
      id: record.id,
      currentRevision: governance.revision,
      currentHash: record.contentHash,
      expectedRevision,
      expectedHash,
    });
  }
}

function requireUser(actor: "user" | "trusted-tool" | undefined): void {
  if (actor !== "user") throw new MemoryGovernanceError("UNAUTHORIZED", "This Memory action requires explicit user confirmation");
}

export function transitionMemoryGovernance(record: MemoryRecord, action: MemoryGovernanceAction, actor: "user" | "trusted-tool" = "user", now = Date.now()): MemoryRecord {
  const current = memoryGovernance(record);
  let next: MemoryGovernance = current;
  let status = record.status;
  if (action === "verify" || action === "reverify") {
    requireUser(actor);
    if (action === "verify" && current.verification !== "unverified") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only unverified Memory can be verified");
    if (action === "reverify" && current.verification !== "stale") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only stale Memory can be re-verified");
    next = { ...current, verification: "verified", verifiedAt: now, verifiedBy: actor };
  } else if (action === "reject") {
    requireUser(actor);
    if (current.verification !== "unverified") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only unverified Memory can be rejected");
    next = { ...current, verification: "rejected", verifiedAt: undefined, verifiedBy: undefined };
  } else if (action === "stale") {
    if (current.verification !== "verified") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only verified Memory can become stale");
    next = { ...current, verification: "stale", pinnedAt: undefined, pinnedBy: undefined };
  } else if (action === "pin") {
    requireUser(actor);
    if (!memoryGovernanceEligible(record, now)) throw new MemoryGovernanceError("INELIGIBLE", "Only verified active Memory can be pinned");
    next = { ...current, pinnedAt: now, pinnedBy: "user" };
  } else if (action === "unpin") {
    requireUser(actor);
    next = { ...current, pinnedAt: undefined, pinnedBy: undefined };
  } else if (action === "archive") {
    requireUser(actor);
    if (record.status !== "active") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only active Memory can be archived");
    status = "archived";
    next = { ...current, pinnedAt: undefined, pinnedBy: undefined };
  } else if (action === "restore") {
    requireUser(actor);
    if (record.status !== "archived") throw new MemoryGovernanceError("INVALID_TRANSITION", "Only archived Memory can be restored");
    status = "active";
  } else if (action === "forget") {
    requireUser(actor);
    if (record.status === "forgotten") throw new MemoryGovernanceError("INVALID_TRANSITION", "Memory is already forgotten");
    status = "forgotten";
    next = { ...current, pinnedAt: undefined, pinnedBy: undefined };
  }
  return Object.freeze({ ...record, status, governance: Object.freeze({ ...next, revision: current.revision + 1 }) });
}

export function conflictGroupFor(title: string): string {
  return `conflict:${createHash("sha256").update(title.trim().toLocaleLowerCase()).digest("hex").slice(0, 24)}`;
}

export function sourceRef(kind: MemorySourceRef["kind"], id: string, contentHash?: MemoryContentHash): MemorySourceRef {
  if (!id.trim() || /[\\/\u0000-\u001f\u007f]/u.test(id)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory source reference id is invalid");
  if (contentHash !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(contentHash)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory source reference hash is invalid");
  return Object.freeze({ kind, id, ...(contentHash === undefined ? {} : { contentHash }) });
}

export interface MemoryExportBundle {
  readonly schemaVersion: 1;
  readonly exportedAt: number;
  readonly records: readonly MemoryRecord[];
}

export function exportMemoryBundle(records: readonly MemoryRecord[], now = Date.now()): string {
  const bundle: MemoryExportBundle = { schemaVersion: 1, exportedAt: now, records: records.map((record) => ({ ...record, governance: memoryGovernance(record) })) };
  return JSON.stringify(bundle);
}

export function importMemoryBundle(serialized: string, now = Date.now()): readonly MemoryRecord[] {
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > MEMORY_MAX_FILE_BYTES) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import exceeds the safe size limit");
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import is not valid JSON"); }
  if (!parsed || typeof parsed !== "object" || (parsed as Record<string, unknown>).schemaVersion !== 1 || !Array.isArray((parsed as Record<string, unknown>).records)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import bundle is invalid");
  const records = (parsed as { records: readonly MemoryRecord[] }).records;
  if (records.length > MEMORY_MAX_IMPORT_RECORDS) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import contains too many records");
  return records.map((record) => {
    if (!record || typeof record !== "object" || typeof record.content !== "string" || record.contentHash !== hashMemoryContent(record.content)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import content hash is invalid");
    const governance = memoryGovernance(record);
    const sourceRefs = [...governance.sourceRefs, sourceRef("import", record.id, record.contentHash)];
    if (sourceRefs.length > 32) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import has too many source references");
    return Object.freeze({ ...record, id: `memory:import:${randomUUID()}`, status: "active" as const, updatedAt: now, governance: { ...governance, origin: "imported" as const, sourceRefs, verification: "unverified" as const, verifiedAt: undefined, verifiedBy: undefined, pinnedAt: undefined, pinnedBy: undefined, revision: 1 } });
  });
}

// --- Markdown (human-readable) import/export --------------------------------
//
// Format: one `# <title>` section per record, separated by a line of `---`.
// Metadata is a `key: value` block between the title and the body. The body is
// the record's content verbatim, so multi-line/markdown content survives a
// round-trip. Import is lossy by design: origin/verification/retention are
// honoured when present, everything else is re-governed by the import path
// (id regenerated, revision 1, unverified, `import` provenance).

export function exportMemoryMarkdown(records: readonly MemoryRecord[], now = Date.now()): string {
  const sections = records
    .filter((record) => record.status !== "forgotten")
    .map((record) => {
      const governance = memoryGovernance(record);
      const meta: string[] = [
        `type: ${record.type}`,
        `scope: ${record.scope}`,
        `verification: ${governance.verification}`,
        `origin: ${governance.origin}`,
        `retention: ${governance.retention}`,
      ];
      if (record.tags.length > 0) meta.push(`tags: ${record.tags.join(", ")}`);
      meta.push(`updated: ${new Date(record.updatedAt).toISOString()}`);
      return `# ${record.title}\n\n${meta.join("\n")}\n\n${record.content}`;
    });
  if (sections.length === 0) return "# Workspace Memory\n\n(empty)\n";
  return `${sections.join("\n\n---\n\n")}\n`;
}

export function importMemoryMarkdown(markdown: string, now = Date.now()): readonly MemoryRecord[] {
  if (typeof markdown !== "string" || Buffer.byteLength(markdown, "utf8") > MEMORY_MAX_FILE_BYTES) {
    throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import exceeds the safe size limit");
  }
  const sections = markdown.split(/\r?\n---[ \t]*\r?\n/u);
  const records: MemoryRecord[] = [];
  for (const section of sections) {
    const parsed = parseMemoryMarkdownSection(section);
    if (parsed === undefined) continue;
    if (records.length >= MEMORY_MAX_IMPORT_RECORDS) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import contains too many records");
    const { title, content, type, tags, verification, origin, retention } = parsed;
    records.push(Object.freeze({
      schemaVersion: MEMORY_SCHEMA_VERSION,
      id: `memory:import:${randomUUID()}`,
      scope: "project" as const,
      scopeKey: "",
      type,
      title,
      content,
      tags,
      provenance: { kind: "import" as const, note: "markdown import" },
      createdAt: now,
      updatedAt: now,
      useCount: 0,
      contentHash: hashMemoryContent(content),
      status: "active" as const,
      governance: { origin, sourceRefs: [], verification, revision: 1, retention },
    }));
  }
  if (records.length === 0) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory import contains no records");
  return records;
}

function parseMemoryMarkdownSection(section: string): {
  readonly title: string;
  readonly content: string;
  readonly type: MemoryType;
  readonly tags: readonly string[];
  readonly verification: MemoryVerification;
  readonly origin: MemoryOrigin;
  readonly retention: MemoryRetention;
} | undefined {
  const lines = section.split(/\r?\n/u);
  let cursor = 0;
  while (cursor < lines.length && lines[cursor]!.trim() === "") cursor += 1;
  const titleLine = lines[cursor]?.trim();
  if (!titleLine?.startsWith("# ")) return undefined;
  const title = titleLine.slice(2).trim();
  if (!title) return undefined;
  cursor += 1;
  while (cursor < lines.length && lines[cursor]!.trim() === "") cursor += 1;
  const meta = new Map<string, string>();
  while (cursor < lines.length) {
    const line = lines[cursor]!.trim();
    if (!line) break;
    const match = /^([A-Za-z-]+):\s*(.*)$/u.exec(line);
    if (!match) break;
    meta.set(match[1]!.toLowerCase(), match[2]!.trim());
    cursor += 1;
  }
  while (cursor < lines.length && lines[cursor]!.trim() === "") cursor += 1;
  const content = lines.slice(cursor).join("\n").trim();
  if (!content) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory markdown record has no content");
  const type = (meta.get("type") ?? "fact") as MemoryType;
  if (!MEMORY_TYPES.includes(type)) throw new MemoryGovernanceError("INVALID_SOURCE", "Memory markdown type is invalid");
  const tags = (meta.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, MEMORY_MAX_TAGS);
  const verification = (meta.get("verification") ?? "unverified") as MemoryVerification;
  const origin = (meta.get("origin") ?? "imported") as MemoryOrigin;
  const retention = (meta.get("retention") ?? "user-managed") as MemoryRetention;
  return { title, content, type, tags, verification, origin, retention };
}
