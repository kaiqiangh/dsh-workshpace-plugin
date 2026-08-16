import assert from "node:assert/strict";
import { access, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MemoryStore,
  MemoryStoreError,
  MEMORY_MAX_FILE_BYTES,
  memoryStorePath,
} from "../src/domain/memory-store.ts";

async function store(scopeKey = "root:project") {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-"));
  const filePath = join(root, "records.jsonl");
  const value = new MemoryStore({ scope: "project", scopeKey, projectRoot: root, filePath, now: () => 100, idFactory: () => "memory:one" });
  await value.open();
  return { root, filePath, value };
}

test("round-trips bounded records, deterministic search, tombstones, and last-used data", async () => {
  const first = await store();
  const record = await first.value.upsert({
    scope: "project",
    scopeKey: "root:project",
    type: "decision",
    title: "Use JSONL",
    content: "Keep the project memory inspectable.",
    tags: ["storage"],
    provenance: { kind: "user", note: "explicit" },
  });
  assert.match(record.contentHash, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(first.value.search("JSONL")[0]?.id, record.id);
  const used = await first.value.markUsed(record.id);
  assert.equal(used.useCount, 1);
  assert.equal(used.lastUsedAt, 100);
  await first.value.archive(record.id);
  assert.equal(first.value.list().length, 0);
  await first.value.forget(record.id);
  await first.value.compact();
  await first.value.close();

  const reopened = new MemoryStore({ scope: "project", scopeKey: "root:project", projectRoot: first.root, filePath: first.filePath, now: () => 101 });
  const state = await reopened.open();
  assert.equal(state.records[0]?.status, "forgotten");
  assert.equal(state.records[0]?.useCount, 1);
});

test("keeps expired verified Memory visible as stale for repair and export", async () => {
  let now = 10;
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-expiry-"));
  const filePath = join(root, "records.jsonl");
  const value = new MemoryStore({ scope: "project", scopeKey: "root:expiry", projectRoot: root, filePath, now: () => now, idFactory: () => "memory:expiry" });
  await value.open();
  const record = await value.upsert({
    scope: "project", scopeKey: "root:expiry", type: "fact", title: "Expires", content: "repair me", tags: [], provenance: { kind: "user" },
    governance: { origin: "user-authored", sourceRefs: [], verification: "verified", verifiedAt: 10, verifiedBy: "user", revision: 1, expiresAt: 20, retention: "project-delete" },
  });
  now = 21;
  assert.equal(value.list()[0]?.governance?.verification, "stale");
  assert.equal(value.search("Expires")[0]?.governance?.verification, "stale");
  assert.equal(value.all()[0]?.governance?.revision, 2);
  assert.equal(record.content, "repair me");
});

test("quarantines malformed and bad-hash lines while preserving valid records", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-corrupt-"));
  const filePath = join(root, "records.jsonl");
  const valid = new MemoryStore({ scope: "project", scopeKey: "root:corrupt", projectRoot: root, filePath, idFactory: () => "memory:valid", now: () => 10 });
  await valid.open();
  const record = await valid.upsert({ scope: "project", scopeKey: "root:corrupt", type: "fact", title: "Valid", content: "yes", tags: [], provenance: { kind: "tool" } });
  await valid.close();
  await writeFile(filePath, `${JSON.stringify({ ...record, contentHash: "sha256:" + "0".repeat(64) })}\nnot-json\n${JSON.stringify(record)}\n`, "utf8");
  const reopened = new MemoryStore({ scope: "project", scopeKey: "root:corrupt", filePath, projectRoot: root });
  const state = await reopened.open();
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0]?.id, record.id);
  assert.equal(state.warnings.length, 2);
  assert.equal((await readFile(`${filePath}.corrupt`, "utf8")).split("\n").filter(Boolean).length, 2);
});

test("unknown schemas open read-only and reject writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-schema-"));
  const filePath = join(root, "records.jsonl");
  await writeFile(filePath, `${JSON.stringify({ schemaVersion: 99, id: "future" })}\n`, "utf8");
  const value = new MemoryStore({ scope: "project", scopeKey: "root:future", projectRoot: root, filePath });
  const state = await value.open();
  assert.equal(state.readOnly, true);
  await assert.rejects(() => value.upsert({ scope: "project", scopeKey: "root:future", type: "fact", title: "Nope", content: "no", tags: [], provenance: { kind: "user" } }), (error: unknown) => error instanceof MemoryStoreError && error.code === "UNSUPPORTED_SCHEMA");
});

test("uses isolated scope-keyed locations and requires explicit project roots", () => {
  const dshHome = "/tmp/dsh-home";
  assert.match(memoryStorePath({ scope: "user", scopeKey: "user-1", dshHome }), /workspace-memory\/user\.jsonl$/u);
  assert.match(memoryStorePath({ scope: "session", scopeKey: "session-1|root-1", dshHome }), /workspace-memory\/sessions\/[0-9a-f]{32}\.jsonl$/u);
  assert.match(memoryStorePath({ scope: "shared-project", scopeKey: "root-1", projectRoot: "/tmp/project" }), /\.dsh\/workspace-memory\/shared\.jsonl$/u);
  assert.throws(() => memoryStorePath({ scope: "project", scopeKey: "root-1" }), /Project Memory Root is unavailable/);
});

test("keeps multiple User profiles in the shared JSONL file across compaction", async () => {
  const home = await mkdtemp(join(tmpdir(), "dsh-memory-profiles-"));
  const filePath = join(home, "workspace-memory", "user.jsonl");
  const first = new MemoryStore({ scope: "user", scopeKey: "profile-a", dshHome: home, filePath, idFactory: () => "memory:a", now: () => 1 });
  await first.open();
  await first.upsert({ scope: "user", scopeKey: "profile-a", type: "preference", title: "A", content: "one", tags: [], provenance: { kind: "user" } });
  const second = new MemoryStore({ scope: "user", scopeKey: "profile-b", dshHome: home, filePath, idFactory: () => "memory:b", now: () => 2 });
  await second.open();
  await second.upsert({ scope: "user", scopeKey: "profile-b", type: "preference", title: "B", content: "two", tags: [], provenance: { kind: "user" } });
  await first.close();
  const reopened = new MemoryStore({ scope: "user", scopeKey: "profile-a", dshHome: home, filePath });
  await reopened.open();
  assert.deepEqual(reopened.list().map((record) => record.title), ["A"]);
  await reopened.compact();
  const other = new MemoryStore({ scope: "user", scopeKey: "profile-b", dshHome: home, filePath });
  await other.open();
  assert.deepEqual(other.list().map((record) => record.title), ["B"]);
});

test("migrates known schemas atomically and fails closed for missing projects", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-migrate-"));
  const filePath = join(root, "records.jsonl");
  const source = new MemoryStore({ scope: "project", scopeKey: "root:migrate", projectRoot: root, filePath, idFactory: () => "memory:migrate", now: () => 1 });
  await source.open();
  const record = await source.upsert({ scope: "project", scopeKey: "root:migrate", type: "fact", title: "Old", content: "value", tags: [], provenance: { kind: "import" } });
  await writeFile(filePath, `${JSON.stringify({ ...record, schemaVersion: 0 })}\n`, "utf8");
  const migrated = new MemoryStore({ scope: "project", scopeKey: "root:migrate", projectRoot: root, filePath, migrations: [{ from: 0, to: 1, migrate: (value) => ({ ...value, schemaVersion: 1 }) }] });
  assert.equal((await migrated.open()).records[0]?.title, "Old");
  await access(`${filePath}.bak`);
  const missing = new MemoryStore({ scope: "project", scopeKey: "root:missing", projectRoot: join(root, "gone") });
  await assert.rejects(() => missing.open(), (error: unknown) => error instanceof MemoryStoreError && error.code === "PROJECT_UNAVAILABLE");
});

test("compaction reconciles another writer before replacing the append-only log", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-writers-"));
  const filePath = join(root, "records.jsonl");
  const first = new MemoryStore({ scope: "project", scopeKey: "root:writers", projectRoot: root, filePath, idFactory: () => "memory:a", now: () => 1 });
  const second = new MemoryStore({ scope: "project", scopeKey: "root:writers", projectRoot: root, filePath, idFactory: () => "memory:b", now: () => 2 });
  await first.open();
  await second.open();
  await first.upsert({ scope: "project", scopeKey: "root:writers", type: "fact", title: "A", content: "a", tags: [], provenance: { kind: "user" } });
  await second.upsert({ scope: "project", scopeKey: "root:writers", type: "fact", title: "B", content: "b", tags: [], provenance: { kind: "user" } });
  await first.compact();
  const reopened = new MemoryStore({ scope: "project", scopeKey: "root:writers", projectRoot: root, filePath });
  await reopened.open();
  assert.deepEqual(reopened.list().map((record) => record.title).sort(), ["A", "B"]);
});

test("fails closed for oversized stores and project memory symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-boundary-"));
  const oversized = join(root, "records.jsonl");
  await writeFile(oversized, Buffer.alloc(MEMORY_MAX_FILE_BYTES + 1, 0x20));
  const large = new MemoryStore({ scope: "project", scopeKey: "root:large", projectRoot: root, filePath: oversized });
  const state = await large.open();
  assert.equal(state.readOnly, true);
  assert.equal(state.warnings[0]?.code, "STORE_TOO_LARGE");

  const outside = await mkdtemp(join(tmpdir(), "dsh-memory-outside-"));
  await symlink(outside, join(root, ".dsh"));
  const escaped = new MemoryStore({ scope: "project", scopeKey: "root:escape", projectRoot: root, filePath: join(root, ".dsh", "workspace-memory", "records.jsonl") });
  await assert.rejects(() => escaped.open(), (error: unknown) => error instanceof MemoryStoreError && error.code === "PROJECT_UNAVAILABLE");
});
