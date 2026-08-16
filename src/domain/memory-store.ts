import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open as openFile, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const MEMORY_SCHEMA_VERSION = 1 as const;
export const MEMORY_MAX_TITLE_BYTES = 256;
export const MEMORY_MAX_CONTENT_BYTES = 64 * 1024;
export const MEMORY_MAX_TAGS = 32;
export const MEMORY_MAX_TAG_BYTES = 64;
export const MEMORY_MAX_QUERY_BYTES = 256;
export const MEMORY_MAX_RESULTS = 100;

export type MemoryScope = "session" | "project" | "user" | "shared-project";
export type MemoryType = "decision" | "preference" | "convention" | "fact";
export type MemoryStatus = "active" | "archived" | "forgotten";
export type MemoryProvenanceKind = "user" | "agent" | "tool" | "import";

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
  readonly contentHash: `sha256:${string}`;
  readonly status: MemoryStatus;
}

export type MemoryDraft = Pick<MemoryRecord, "scope" | "scopeKey" | "type" | "title" | "content" | "tags" | "provenance"> & {
  readonly id?: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly lastUsedAt?: number;
  readonly useCount?: number;
  readonly status?: MemoryStatus;
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
}

export interface MemoryStoreWarning {
  readonly code: "CORRUPT_RECORD" | "BAD_HASH" | "UNSUPPORTED_SCHEMA" | "TRUNCATED_LINE";
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

function hashFor(content: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
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
    contentHash: record.contentHash as `sha256:${string}`,
    status: record.status as MemoryStatus,
  });
}

function recordRank(record: MemoryRecord, query: string): number {
  const lower = query.toLocaleLowerCase();
  const title = record.title.toLocaleLowerCase();
  const content = record.content.toLocaleLowerCase();
  const tags = record.tags.map((tag) => tag.toLocaleLowerCase());
  if (title === lower) return 0;
  if (title.includes(lower) || tags.some((tag) => tag === lower)) return 1;
  const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const haystack = `${title} ${content} ${tags.join(" ")}`;
  const overlap = tokens.filter((token) => haystack.includes(token)).length;
  if (overlap === tokens.length && tokens.length > 0) return 2;
  if (title.startsWith(lower) || tags.some((tag) => tag.startsWith(lower))) return 3;
  if (overlap > 0) return 4;
  return 5;
}

export class MemoryStore {
  readonly filePath: string;
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly maxContentBytes: number;
  private records = new Map<string, MemoryRecord>();
  private warnings: MemoryStoreWarning[] = [];
  private readOnly = false;
  private opened = false;

  constructor(options: MemoryStoreOptions) {
    if (!scopes.includes(options.scope)) throw new MemoryStoreError("INVALID_RECORD", "Memory scope is invalid");
    text(options.scopeKey, 512, "Memory scope key");
    this.scope = options.scope;
    this.scopeKey = options.scopeKey;
    this.filePath = options.filePath ?? memoryStorePath(options);
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? (() => `memory:${randomUUID()}`);
    this.maxContentBytes = safeLimit(options.maxContentBytes, MEMORY_MAX_CONTENT_BYTES);
  }

  async open(): Promise<MemoryReadState> {
    if (this.opened) return this.state();
    this.opened = true;
    let source: string;
    try {
      source = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as { code?: string })?.code === "ENOENT") return this.state();
      this.opened = false;
      throw new MemoryStoreError("STORE_UNAVAILABLE", "Memory store cannot be read");
    }
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as unknown;
        const record = validateRecord(parsed, this.scope, this.scopeKey, this.maxContentBytes);
        this.records.set(record.id, record);
        if (record.status === "forgotten") this.records.set(record.id, record);
      } catch (error) {
        const code = error instanceof MemoryStoreError && error.code === "UNSUPPORTED_SCHEMA" ? "UNSUPPORTED_SCHEMA" : error instanceof MemoryStoreError && error.message.includes("hash") ? "BAD_HASH" : "CORRUPT_RECORD";
        this.warnings.push({ code, line: index + 1, message: error instanceof Error ? error.message : "Memory record is invalid" });
        if (code === "UNSUPPORTED_SCHEMA") this.readOnly = true;
        else await this.quarantine(`${line}\n`, index + 1);
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
      .filter((record) => (options.type === undefined || record.type === options.type) && (options.status === undefined ? record.status === "active" : record.status === options.status))
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
      .filter((record) => record.status === (options.status ?? "active") && (options.type === undefined || record.type === options.type))
      .filter((record) => recordRank(record, query) < 5)
      .sort((left, right) => recordRank(left, query) - recordRank(right, query) || right.updatedAt - left.updatedAt || (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0) || left.id.localeCompare(right.id))
      .slice(0, limit));
  }

  async compact(): Promise<void> {
    this.ensureWritable();
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    const backup = `${this.filePath}.bak`;
    const body = [...this.records.values()].map((record) => JSON.stringify(record)).join("\n") + (this.records.size ? "\n" : "");
    try {
      await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
      await writeFile(temporary, body, { encoding: "utf8", mode: 0o600 });
      const handle = await openFile(temporary, "r+");
      await handle.sync();
      await handle.close();
      try { await rename(this.filePath, backup); } catch (error) { if ((error as { code?: string })?.code !== "ENOENT") throw error; }
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } catch {
      try { await rename(temporary, this.filePath); } catch { /* preserve the previous source */ }
      throw new MemoryStoreError("SAVE_FAILURE", "Memory compaction failed");
    }
  }

  async close(): Promise<void> {
    this.opened = false;
    this.records.clear();
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
  }

  private async quarantine(line: string, lineNumber: number): Promise<void> {
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
