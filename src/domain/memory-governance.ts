import { createHash, randomUUID } from "node:crypto";

import {
  hashMemoryContent,
  MEMORY_MAX_FILE_BYTES,
  type MemoryGovernance,
  type MemoryContentHash,
  type MemoryOrigin,
  type MemoryRecord,
  type MemoryRetention,
  type MemorySourceRef,
  type MemoryVerification,
} from "./memory-store.ts";

export const MEMORY_MAX_IMPORT_RECORDS = 10_000;

export type MemoryGovernanceAction = "verify" | "reject" | "reverify" | "pin" | "unpin" | "archive" | "restore" | "stale" | "forget";

export type MemoryGovernanceErrorCode = "INVALID_TRANSITION" | "UNAUTHORIZED" | "CONFLICT" | "INELIGIBLE" | "INVALID_SOURCE";

export class MemoryGovernanceError extends Error {
  readonly code: MemoryGovernanceErrorCode;

  constructor(code: MemoryGovernanceErrorCode, message: string) {
    super(message);
    this.name = "MemoryGovernanceError";
    this.code = code;
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
    throw new MemoryGovernanceError("CONFLICT", `Memory ${record.id} changed before this edit`);
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
