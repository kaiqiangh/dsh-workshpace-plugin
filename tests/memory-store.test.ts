import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MemoryStore,
  MemoryStoreError,
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

  const reopened = new MemoryStore({ scope: "project", scopeKey: "root:project", filePath: first.filePath, now: () => 101 });
  const state = await reopened.open();
  assert.equal(state.records[0]?.status, "forgotten");
  assert.equal(state.records[0]?.useCount, 1);
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
