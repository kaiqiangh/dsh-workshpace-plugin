import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open as openFile, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

export const MEMORY_SCHEMA_VERSION = 1 as const;
export const MEMORY_MAX_TITLE_BYTES = 256;
export const MEMORY_MAX_CONTENT_BYTES = 64 * 1024;
export const MEMORY_MAX_TAGS = 32;
export const MEMORY_MAX_TAG_BYTES = 64;
export const MEMORY_MAX_QUERY_BYTES = 256;
export const MEMORY_MAX_RESULTS = 100;
export const MEMORY_MAX_FILE_BYTES = 8 * 1024 * 1024;

export type MemoryScope = "session" | "project" | "user" | "shared-project";
export type MemoryType = "decision" | "preference" | "convention" | "fact";
export type MemoryStatus = "active" | "archived" | "forgotten";
export type MemoryProvenanceKind = "user" | "agent" | "tool" | "import";
export type MemoryOrigin = "user-authored" | "imported" | "derived" | "model-suggested";
export type MemoryVerification = "unverified" | "verified" | "rejected" | "stale";
export type MemoryConfidence = "low" | "medium" | "high";
export type MemoryRetention = "session-end" | "project-delete" | "user-managed";
// Remote codecs accept string only; runtime validation below enforces sha256:<64 hex>.
export type MemoryContentHash = string;

export interface MemorySourceRef {
  readonly kind: "session" | "event" | "file" | "url" | "import";
  readonly id: string;
  readonly contentHash?: MemoryContentHash;
}

export interface MemoryGovernance {
  readonly origin: MemoryOrigin;
  readonly sourceRefs: readonly MemorySourceRef[];
  readonly verification: MemoryVerification;
  readonly verifiedAt?: number;
  readonly verifiedBy?: "user" | "trusted-tool";
  readonly confidence?: MemoryConfidence;
  readonly revision: number;
  readonly conflictGroup?: string;
  readonly pinnedAt?: number;
  readonly pinnedBy?: "user";
  readonly expiresAt?: number;
  readonly retention: MemoryRetention;
}

export interface MemoryProvenance {
  readonly kind: MemoryProvenanceKind;
  readonly sessionId?: string;
  readonly eventSeq?: number;
  readonly note?: string;
}

export interface MemoryRecord {
  readonly schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  readonly id: string;
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  readonly type: MemoryType;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly provenance: MemoryProvenance;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastUsedAt?: number;
  readonly useCount: number;
  readonly contentHash: MemoryContentHash;
  readonly status: MemoryStatus;
  readonly governance?: MemoryGovernance;
}

export type MemoryDraft = Pick<MemoryRecord, "scope" | "scopeKey" | "type" | "title" | "content" | "tags" | "provenance"> & {
  readonly id?: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly lastUsedAt?: number;
  readonly useCount?: number;
  readonly status?: MemoryStatus;
  readonly governance?: MemoryGovernance;
  readonly expectedRevision?: number;
  readonly expectedHash?: string;
};

export interface MemoryStoreLocationOptions {
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  readonly projectRoot?: string;
  readonly dshHome?: string;
}

export interface MemoryStoreOptions extends MemoryStoreLocationOptions {
  readonly filePath?: string;
  readonly now?: () => number;
  readonly idFactory?: () => string;
  readonly maxContentBytes?: number;
  readonly migrations?: readonly MemoryMigration[];
}

export interface MemoryMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (record: Record<string, unknown>) => Record<string, unknown>;
}

export interface MemoryStoreWarning {
  readonly code: "CORRUPT_RECORD" | "BAD_HASH" | "UNSUPPORTED_SCHEMA" | "TRUNCATED_LINE" | "STORE_TOO_LARGE";
  readonly line: number;
  readonly message: string;
}

export interface MemoryReadState {
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  readonly records: readonly MemoryRecord[];
  readonly warnings: readonly MemoryStoreWarning[];
  readonly readOnly: boolean;
}

export interface MemoryListOptions {
  readonly type?: MemoryType;
  readonly status?: MemoryStatus;
  readonly limit?: number;
}

export interface MemorySearchOptions extends MemoryListOptions {
  readonly limit?: number;
}

export type MemoryStoreErrorCode =
  | "INVALID_RECORD"
  | "SCOPE_MISMATCH"
  | "PROJECT_UNAVAILABLE"
  | "STORE_UNAVAILABLE"
  | "STORE_CLOSED"
  | "SAVE_FAILURE"
  | "UNSUPPORTED_SCHEMA";

export class MemoryStoreError extends Error {
  readonly code: MemoryStoreErrorCode;

  constructor(code: MemoryStoreErrorCode, message: string) {
    super(message);
    this.name = "MemoryStoreError";
    this.code = code;
  }
}

const scopes: readonly MemoryScope[] = ["session", "project", "user", "shared-project"];
const types: readonly MemoryType[] = ["decision", "preference", "convention", "fact"];
const statuses: readonly MemoryStatus[] = ["active", "archived", "forgotten"];
const provenanceKinds: readonly MemoryProvenanceKind[] = ["user", "agent", "tool", "import"];

function text(value: unknown, max: number, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > max || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new MemoryStoreError("INVALID_RECORD", `${label} is invalid`);
  }
}

function optionalText(value: unknown, max: number, label: string): void {
  if (value !== undefined) text(value, max, label);
}

function contentText(value: unknown, max: number): asserts value is string {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > max || /[\u0000\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new MemoryStoreError("INVALID_RECORD", "Memory content is invalid");
  }
}

function boundedInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new MemoryStoreError("INVALID_RECORD", `${label} is invalid`);
}

function hashFor(content: string): MemoryContentHash {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function validateGovernance(value: unknown, scope: MemoryScope): MemoryGovernance | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory governance is invalid");
  const governance = value as Record<string, unknown>;
  const origins: readonly MemoryOrigin[] = ["user-authored", "imported", "derived", "model-suggested"];
  const verifications: readonly MemoryVerification[] = ["unverified", "verified", "rejected", "stale"];
  const confidences: readonly MemoryConfidence[] = ["low", "medium", "high"];
  const retentions: readonly MemoryRetention[] = ["session-end", "project-delete", "user-managed"];
  if (!origins.includes(governance.origin as MemoryOrigin) || !verifications.includes(governance.verification as MemoryVerification) || !retentions.includes(governance.retention as MemoryRetention)) throw new MemoryStoreError("INVALID_RECORD", "Memory governance enum is invalid");
  if (!Array.isArray(governance.sourceRefs) || governance.sourceRefs.length > 32) throw new MemoryStoreError("INVALID_RECORD", "Memory source references are invalid");
  const sourceRefs = governance.sourceRefs.map((source) => {
    if (!source || typeof source !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory source reference is invalid");
    const ref = source as Record<string, unknown>;
    const sourceKinds: readonly MemorySourceRef["kind"][] = ["session", "event", "file", "url", "import"];
    if (!sourceKinds.includes(ref.kind as MemorySourceRef["kind"])) throw new MemoryStoreError("INVALID_RECORD", "Memory source reference kind is invalid");
    text(ref.id, 256, "Memory source reference id");
    if (ref.contentHash !== undefined && (!/^sha256:[0-9a-f]{64}$/u.test(String(ref.contentHash)))) throw new MemoryStoreError("INVALID_RECORD", "Memory source reference hash is invalid");
    return Object.freeze({ kind: ref.kind as MemorySourceRef["kind"], id: ref.id, ...(ref.contentHash === undefined ? {} : { contentHash: ref.contentHash as MemoryContentHash }) });
  });
  if (governance.origin !== "user-authored" && sourceRefs.length === 0) throw new MemoryStoreError("INVALID_RECORD", "Non-user Memory requires a source reference");
  if (!Number.isSafeInteger(governance.revision) || (governance.revision as number) < 1) throw new MemoryStoreError("INVALID_RECORD", "Memory revision is invalid");
  if (governance.confidence !== undefined && !confidences.includes(governance.confidence as MemoryConfidence)) throw new MemoryStoreError("INVALID_RECORD", "Memory confidence is invalid");
  if (governance.verifiedBy !== undefined && governance.verifiedBy !== "user" && governance.verifiedBy !== "trusted-tool") throw new MemoryStoreError("INVALID_RECORD", "Memory verifiedBy is invalid");
  if (governance.verifiedAt !== undefined) boundedInteger(governance.verifiedAt, "Memory verifiedAt");
  if (governance.expiresAt !== undefined) boundedInteger(governance.expiresAt, "Memory expiresAt");
  if (governance.pinnedAt !== undefined) boundedInteger(governance.pinnedAt, "Memory pinnedAt");
  if (governance.pinnedBy !== undefined && governance.pinnedBy !== "user") throw new MemoryStoreError("INVALID_RECORD", "Memory pinnedBy is invalid");
  if (governance.pinnedAt !== undefined && governance.pinnedBy === undefined) throw new MemoryStoreError("INVALID_RECORD", "Pinned Memory requires an actor");
  if (governance.verification === "verified" && governance.verifiedAt === undefined) throw new MemoryStoreError("INVALID_RECORD", "Verified Memory requires a timestamp");
  return Object.freeze({
    origin: governance.origin as MemoryOrigin,
    sourceRefs: Object.freeze(sourceRefs),
    verification: governance.verification as MemoryVerification,
    ...(governance.verifiedAt === undefined ? {} : { verifiedAt: governance.verifiedAt as number }),
    ...(governance.verifiedBy === undefined ? {} : { verifiedBy: governance.verifiedBy as "user" | "trusted-tool" }),
    ...(governance.confidence === undefined ? {} : { confidence: governance.confidence as MemoryConfidence }),
    revision: governance.revision as number,
    ...(governance.conflictGroup === undefined ? {} : { conflictGroup: governance.conflictGroup as string }),
    ...(governance.pinnedAt === undefined ? {} : { pinnedAt: governance.pinnedAt as number }),
    ...(governance.pinnedBy === undefined ? {} : { pinnedBy: "user" as const }),
    ...(governance.expiresAt === undefined ? {} : { expiresAt: governance.expiresAt as number }),
    retention: governance.retention as MemoryRetention,
  });
}

function safeLimit(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && value! > 0 ? Math.min(value!, fallback) : fallback;
}

function safeFilePart(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function memoryStorePath(options: MemoryStoreLocationOptions): string {
  if (!scopes.includes(options.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope is invalid");
  text(options.scopeKey, 512, "Memory scope key");
  if (options.scope === "project" || options.scope === "shared-project") {
    if (typeof options.projectRoot !== "string" || !options.projectRoot.trim()) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
    return join(options.projectRoot, ".dsh", "workspace-memory", options.scope === "project" ? "records.jsonl" : "shared.jsonl");
  }
  if (typeof options.dshHome !== "string" || !options.dshHome.trim()) throw new MemoryStoreError("STORE_UNAVAILABLE", "DSH_HOME is unavailable");
  return options.scope === "user"
    ? join(options.dshHome, "workspace-memory", "user.jsonl")
    : join(options.dshHome, "workspace-memory", "sessions", `${safeFilePart(options.scopeKey)}.jsonl`);
}

function validateRecord(value: unknown, expectedScope: MemoryScope, expectedScopeKey: string, maxContentBytes = MEMORY_MAX_CONTENT_BYTES): MemoryRecord {
  if (!value || typeof value !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory record must be an object");
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== MEMORY_SCHEMA_VERSION) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory record schema is unsupported");
  text(record.id, 256, "Memory id");
  if (!scopes.includes(record.scope as MemoryScope) || record.scope !== expectedScope || record.scopeKey !== expectedScopeKey) throw new MemoryStoreError("SCOPE_MISMATCH", "Memory record scope does not match this store");
  text(record.scopeKey, 512, "Memory scope key");
  if (!types.includes(record.type as MemoryType)) throw new MemoryStoreError("INVALID_RECORD", "Memory type is invalid");
  text(record.title, MEMORY_MAX_TITLE_BYTES, "Memory title");
  contentText(record.content, maxContentBytes);
  if (!Array.isArray(record.tags) || record.tags.length > MEMORY_MAX_TAGS) throw new MemoryStoreError("INVALID_RECORD", "Memory tags are invalid");
  const tags = record.tags.map((tag) => { text(tag, MEMORY_MAX_TAG_BYTES, "Memory tag"); return tag; });
  if (!record.provenance || typeof record.provenance !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory provenance is invalid");
  const provenance = record.provenance as Record<string, unknown>;
  if (!provenanceKinds.includes(provenance.kind as MemoryProvenanceKind)) throw new MemoryStoreError("INVALID_RECORD", "Memory provenance kind is invalid");
  optionalText(provenance.sessionId, 256, "Memory provenance session");
  optionalText(provenance.note, 512, "Memory provenance note");
  if (provenance.eventSeq !== undefined) boundedInteger(provenance.eventSeq, "Memory provenance event");
  boundedInteger(record.createdAt, "Memory createdAt");
  boundedInteger(record.updatedAt, "Memory updatedAt");
  if (record.updatedAt < record.createdAt) throw new MemoryStoreError("INVALID_RECORD", "Memory timestamps are invalid");
  if (record.lastUsedAt !== undefined) boundedInteger(record.lastUsedAt, "Memory lastUsedAt");
  boundedInteger(record.useCount, "Memory useCount");
  if (!statuses.includes(record.status as MemoryStatus)) throw new MemoryStoreError("INVALID_RECORD", "Memory status is invalid");
  text(record.contentHash, 80, "Memory content hash");
  if (!/^sha256:[0-9a-f]{64}$/u.test(record.contentHash) || record.contentHash !== hashFor(record.content)) throw new MemoryStoreError("INVALID_RECORD", "Memory content hash is invalid");
  const governance = validateGovernance(record.governance, expectedScope);
  const normalizedProvenance: { kind: MemoryProvenanceKind; sessionId?: string; eventSeq?: number; note?: string } = { kind: provenance.kind as MemoryProvenanceKind };
  if (provenance.sessionId !== undefined) normalizedProvenance.sessionId = provenance.sessionId as string;
  if (provenance.eventSeq !== undefined) normalizedProvenance.eventSeq = provenance.eventSeq as number;
  if (provenance.note !== undefined) normalizedProvenance.note = provenance.note as string;
  return Object.freeze({
    schemaVersion: MEMORY_SCHEMA_VERSION,
    id: record.id,
    scope: record.scope as MemoryScope,
    scopeKey: record.scopeKey,
    type: record.type as MemoryType,
    title: record.title,
    content: record.content,
    tags: Object.freeze(tags),
    provenance: Object.freeze(normalizedProvenance),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.lastUsedAt === undefined ? {} : { lastUsedAt: record.lastUsedAt }),
    useCount: record.useCount,
    contentHash: record.contentHash,
    status: record.status as MemoryStatus,
    ...(governance === undefined ? {} : { governance }),
  });
}

function recordRank(record: MemoryRecord, query: string): number {
  const lower = query.toLocaleLowerCase();
  const title = record.title.toLocaleLowerCase();
  const content = record.content.toLocaleLowerCase();
  const tags = record.tags.map((tag) => tag.toLocaleLowerCase());
  if (title === lower) return 0;
  if (title.includes(lower) || content.includes(lower) || tags.some((tag) => tag === lower)) return 1;
  const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const haystack = `${title} ${content} ${tags.join(" ")}`;
  const overlap = tokens.filter((token) => haystack.includes(token)).length;
  if (overlap === tokens.length && tokens.length > 0) return 2;
  if (title.startsWith(lower) || tags.some((tag) => tag.startsWith(lower))) return 3;
  if (overlap > 0) return 4;
  return 5;
}

function migrateValue(value: Record<string, unknown>, migrations: readonly MemoryMigration[]): Record<string, unknown> {
  let current = value;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : NaN;
  const seen = new Set<number>();
  while (version !== MEMORY_SCHEMA_VERSION) {
    if (!Number.isSafeInteger(version)) throw new MemoryStoreError("INVALID_RECORD", "Memory record schema is invalid");
    if (seen.has(version)) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory record schema is unsupported");
    seen.add(version);
    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration || migration.to <= migration.from) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory record schema is unsupported");
    current = migration.migrate(current);
    version = typeof current.schemaVersion === "number" ? current.schemaVersion : NaN;
  }
  return current;
}

export class MemoryStore {
  readonly filePath: string;
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly maxContentBytes: number;
  private readonly projectRoot?: string;
  private readonly migrations: readonly MemoryMigration[];
  private records = new Map<string, MemoryRecord>();
  private foreignLines: string[] = [];
  private warnings: MemoryStoreWarning[] = [];
  private readOnly = false;
  private opened = false;

  private async ensureSafePath(): Promise<void> {
    if (!this.projectRoot) return;
    let canonicalRoot: string;
    try { canonicalRoot = await realpath(this.projectRoot); } catch { throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable"); }
    let probe = dirname(this.filePath);
    while (true) {
      try {
        const canonicalProbe = await realpath(probe);
        const relativeProbe = relative(canonicalRoot, canonicalProbe);
        if (relativeProbe === ".." || relativeProbe.startsWith(`..${sep}`) || relativeProbe.startsWith(sep)) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path escapes the Workspace Root");
        break;
      } catch (error) {
        if (error instanceof MemoryStoreError) throw error;
        const parent = dirname(probe);
        if (parent === probe) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path is unavailable");
        probe = parent;
      }
    }
    try {
      const canonicalFile = await realpath(this.filePath);
      const relativeFile = relative(canonicalRoot, canonicalFile);
      if (relativeFile === ".." || relativeFile.startsWith(`..${sep}`) || relativeFile.startsWith(sep)) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path escapes the Workspace Root");
    } catch (error) {
      if ((error as { code?: string })?.code !== "ENOENT") throw error instanceof MemoryStoreError ? error : new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory store path is unavailable");
    }
  }

  constructor(options: MemoryStoreOptions) {
    if (!scopes.includes(options.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope is invalid");
    text(options.scopeKey, 512, "Memory scope key");
    this.scope = options.scope;
    this.scopeKey = options.scopeKey;
    this.filePath = options.filePath ?? memoryStorePath(options);
    this.projectRoot = options.projectRoot;
    this.migrations = options.migrations ?? [];
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? (() => `memory:${randomUUID()}`);
    this.maxContentBytes = safeLimit(options.maxContentBytes, MEMORY_MAX_CONTENT_BYTES);
  }

  async open(): Promise<MemoryReadState> {
    if (this.opened) return this.state();
    if (this.scope === "project" || this.scope === "shared-project") {
      if (!this.projectRoot) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
      try {
        if (!(await stat(this.projectRoot)).isDirectory()) throw new Error("not-directory");
      } catch {
        throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Project Memory Root is unavailable");
      }
    }
    await this.ensureSafePath();
    this.opened = true;
    let source: string;
    try {
      const info = await stat(this.filePath);
      if (info.size > MEMORY_MAX_FILE_BYTES) {
        this.readOnly = true;
        this.warnings.push({ code: "STORE_TOO_LARGE", line: 0, message: "Memory store exceeds the safe read limit" });
        return this.state();
      }
      source = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as { code?: string })?.code === "ENOENT") {
        try {
          await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
          await chmod(dirname(this.filePath), 0o700);
          return this.state();
        } catch {
          this.opened = false;
          throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store directory cannot be secured");
        }
      }
      this.opened = false;
      throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store cannot be read");
    }
    try {
      await chmod(dirname(this.filePath), 0o700);
      await chmod(this.filePath, 0o600);
    } catch {
      this.opened = false;
      throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store permissions cannot be secured");
    }
    const lines = source.split("\n");
    let migrated = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as unknown;
        if (this.scope === "user" && parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).scope === "user" && typeof (parsed as Record<string, unknown>).scopeKey === "string" && (parsed as Record<string, unknown>).scopeKey !== this.scopeKey) {
          try { validateRecord(parsed, "user", (parsed as Record<string, unknown>).scopeKey as string, this.maxContentBytes); } catch { /* preserve another profile's line untouched */ }
          this.foreignLines.push(line);
          continue;
        }
        const migratedValue = parsed && typeof parsed === "object" ? migrateValue(parsed as Record<string, unknown>, this.migrations) : parsed;
        migrated ||= migratedValue !== parsed;
        const record = validateRecord(migratedValue, this.scope, this.scopeKey, this.maxContentBytes);
        this.records.set(record.id, record);
      } catch (error) {
        const truncated = index === lines.length - 1 && !source.endsWith("\n");
        const code = error instanceof MemoryStoreError && error.code === "UNSUPPORTED_SCHEMA" ? "UNSUPPORTED_SCHEMA" : truncated ? "TRUNCATED_LINE" : error instanceof MemoryStoreError && error.message.includes("hash") ? "BAD_HASH" : "CORRUPT_RECORD";
        this.warnings.push({ code, line: index + 1, message: error instanceof Error ? error.message : "Memory record is invalid" });
        if (code === "UNSUPPORTED_SCHEMA") this.readOnly = true;
        else await this.quarantine(`${line}\n`, index + 1);
      }
    }
    if (migrated && !this.readOnly) {
      try { await this.compact(); } catch (error) {
        this.records.clear();
        this.foreignLines = [];
        this.opened = false;
        throw error;
      }
    }
    return this.state();
  }

  state(): MemoryReadState {
    return Object.freeze({ scope: this.scope, scopeKey: this.scopeKey, records: Object.freeze([...this.records.values()]), warnings: Object.freeze([...this.warnings]), readOnly: this.readOnly });
  }

  list(options: MemoryListOptions = {}): readonly MemoryRecord[] {
    this.ensureOpen();
    const limit = safeLimit(options.limit, MEMORY_MAX_RESULTS);
    return Object.freeze([...this.records.values()]
      .filter((record) => (options.type === undefined || record.type === options.type) && (options.status === undefined ? record.status === "active" : record.status === options.status) && (record.governance?.expiresAt === undefined || record.governance.expiresAt > this.now()))
      .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
      .slice(0, limit));
  }

  async upsert(draft: MemoryDraft): Promise<MemoryRecord> {
    this.ensureWritable();
    if (draft.scope !== this.scope || draft.scopeKey !== this.scopeKey) throw new MemoryStoreError("SCOPE_MISMATCH", "Memory draft scope does not match this store");
    const now = this.now();
    const id = draft.id ?? this.idFactory();
    const previous = this.records.get(id);
    const record = validateRecord({
      schemaVersion: MEMORY_SCHEMA_VERSION,
      id,
      scope: this.scope,
      scopeKey: this.scopeKey,
      type: draft.type,
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      provenance: draft.provenance,
      createdAt: draft.createdAt ?? previous?.createdAt ?? now,
      updatedAt: draft.updatedAt ?? now,
      ...(draft.lastUsedAt === undefined && previous?.lastUsedAt === undefined ? {} : { lastUsedAt: draft.lastUsedAt ?? previous?.lastUsedAt }),
      useCount: draft.useCount ?? previous?.useCount ?? 0,
      contentHash: hashFor(draft.content),
      status: draft.status ?? "active",
      ...(draft.governance === undefined && previous?.governance === undefined ? {} : { governance: draft.governance ?? previous?.governance }),
    }, this.scope, this.scopeKey, this.maxContentBytes);
    await this.append(record);
    this.records.set(record.id, record);
    return record;
  }

  async archive(id: string): Promise<MemoryRecord> {
    return this.tombstone(id, "archived");
  }

  async forget(id: string): Promise<MemoryRecord> {
    return this.tombstone(id, "forgotten");
  }

  async markUsed(id: string): Promise<MemoryRecord> {
    this.ensureWritable();
    const current = this.require(id);
    const now = this.now();
    const record = await this.upsert({ ...current, id: current.id, updatedAt: now, lastUsedAt: now, useCount: current.useCount + 1, provenance: current.provenance });
    return record;
  }

  search(query: string, options: MemorySearchOptions = {}): readonly MemoryRecord[] {
    this.ensureOpen();
    text(query, MEMORY_MAX_QUERY_BYTES, "Memory query");
    const limit = safeLimit(options.limit, MEMORY_MAX_RESULTS);
    return Object.freeze([...this.records.values()]
      .filter((record) => record.status === (options.status ?? "active") && (options.type === undefined || record.type === options.type) && (record.governance?.expiresAt === undefined || record.governance.expiresAt > this.now()))
      .filter((record) => recordRank(record, query) < 5)
      .sort((left, right) => recordRank(left, query) - recordRank(right, query) || right.updatedAt - left.updatedAt || (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0) || left.id.localeCompare(right.id))
      .slice(0, limit));
  }

  async compact(): Promise<void> {
    this.ensureWritable();
    return this.withLock(async () => {
      await this.reloadLatest();
      const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
      const backup = `${this.filePath}.bak`;
      const lines = [...this.foreignLines, ...this.records.values()].map((record) => typeof record === "string" ? record : JSON.stringify(record));
      const body = lines.join("\n") + (lines.length ? "\n" : "");
      let backupCreated = false;
      try {
        await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
        await writeFile(temporary, body, { encoding: "utf8", mode: 0o600 });
        const handle = await openFile(temporary, "r+");
        await handle.sync();
        await handle.close();
        try { await rename(this.filePath, backup); backupCreated = true; } catch (error) { if ((error as { code?: string })?.code !== "ENOENT") throw error; }
        await rename(temporary, this.filePath);
        await chmod(this.filePath, 0o600);
      } catch {
        try { await unlink(temporary); } catch { /* no temporary remains */ }
        if (backupCreated) {
          try { await unlink(this.filePath); } catch { /* replacement was not installed */ }
          try { await rename(backup, this.filePath); } catch { /* backup remains recoverable */ }
        }
        throw new MemoryStoreError("SAVE_FAILURE", "Memory compaction failed");
      }
    });
  }

  async close(): Promise<void> {
    this.opened = false;
    this.records.clear();
    this.foreignLines = [];
    this.warnings = [];
    this.readOnly = false;
  }

  private async tombstone(id: string, status: "archived" | "forgotten"): Promise<MemoryRecord> {
    this.ensureWritable();
    const current = this.require(id);
    const record = await this.upsert({ ...current, id: current.id, status, updatedAt: this.now(), provenance: current.provenance });
    return record;
  }

  private require(id: string): MemoryRecord {
    text(id, 256, "Memory id");
    const record = this.records.get(id);
    if (!record) throw new MemoryStoreError("INVALID_RECORD", "Memory record is unavailable");
    return record;
  }

  private ensureOpen(): void {
    if (!this.opened) throw new MemoryStoreError("STORE_CLOSED", "Memory store is not open");
  }

  private ensureWritable(): void {
    this.ensureOpen();
    if (this.readOnly) throw new MemoryStoreError("UNSUPPORTED_SCHEMA", "Memory store is read-only because its schema is newer");
  }

  private async append(record: MemoryRecord): Promise<void> {
    await this.ensureSafePath();
    return this.withLock(async () => {
      try {
        await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
        const handle = await openFile(this.filePath, "a", 0o600);
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
        await handle.sync();
        await handle.close();
        await chmod(this.filePath, 0o600);
      } catch {
        throw new MemoryStoreError("SAVE_FAILURE", "Memory record could not be saved");
      }
    });
  }

  private async reloadLatest(): Promise<void> {
    await this.ensureSafePath();
    let source: string;
    try { source = await readFile(this.filePath, "utf8"); } catch (error) {
      if ((error as { code?: string })?.code === "ENOENT") return;
      throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store cannot be refreshed");
    }
    const latest = new Map(this.records);
    const foreign: string[] = [];
    for (const line of source.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as unknown;
        if (this.scope === "user" && parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).scope === "user" && typeof (parsed as Record<string, unknown>).scopeKey === "string" && (parsed as Record<string, unknown>).scopeKey !== this.scopeKey) {
          foreign.push(line.trim());
          continue;
        }
        const record = validateRecord(parsed, this.scope, this.scopeKey, this.maxContentBytes);
        latest.set(record.id, record);
      } catch {
        // Preserve the current in-memory view for damaged lines; compaction never invents data.
      }
    }
    this.records = latest;
    if (this.scope === "user") this.foreignLines = foreign;
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureSafePath();
    const lockPath = `${this.filePath}.lock`;
    let lock;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
        lock = await openFile(lockPath, "wx", 0o600);
        await lock.writeFile(`${process.pid}\n`, "utf8");
        await lock.close();
        break;
      } catch (error) {
        try { await lock?.close(); } catch { /* lock acquisition failed */ }
        if ((error as { code?: string })?.code !== "EEXIST" || attempt > 0) throw new MemoryStoreError("SAVE_FAILURE", "Memory store is busy");
        try {
          const info = await stat(lockPath);
          if (Date.now() - info.mtimeMs < 30_000) throw new MemoryStoreError("SAVE_FAILURE", "Memory store is busy");
          await unlink(lockPath);
        } catch (staleError) {
          if (staleError instanceof MemoryStoreError) throw staleError;
        }
      }
    }
    try {
      return await operation();
    } finally {
      try { await unlink(lockPath); } catch { /* another process may have repaired a stale lock */ }
    }
  }

  private async quarantine(line: string, lineNumber: number): Promise<void> {
    await this.ensureSafePath();
    try {
      await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
      const quarantinePath = `${this.filePath}.corrupt`;
      const entry = JSON.stringify({ line: lineNumber, capturedAt: this.now(), raw: line });
      const handle = await openFile(quarantinePath, "a", 0o600);
      await handle.writeFile(`${entry}\n`, "utf8");
      await handle.close();
      await chmod(quarantinePath, 0o600);
    } catch {
      // A warning remains authoritative even when the optional quarantine copy cannot be written.
    }
  }
}
