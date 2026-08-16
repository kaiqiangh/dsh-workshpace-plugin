import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceMemoryDomain } from "../src/domain/memory.ts";
import { MemoryGovernanceError } from "../src/domain/memory-governance.ts";
import { MemoryStoreError } from "../src/domain/memory-store.ts";

test("keeps Memory scopes isolated and requires explicit Shared Project opt-in", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-domain-"));
  const dshHome = await mkdtemp(join(tmpdir(), "dsh-memory-home-"));
  const domain = new WorkspaceMemoryDomain(dshHome);
  const context = { identity: { sessionId: "session-1", rootId: "root:one" }, root };
  const project = { scope: "project" as const };
  const state = await domain.open(context, project);
  const record = await domain.upsert(context, project, {
    scope: state.scope,
    scopeKey: state.scopeKey,
    type: "decision",
    title: "Keep local",
    content: "Project-only",
    tags: ["scope"],
    provenance: { kind: "user" },
  });
  assert.equal((await domain.search(context, project, "local"))[0]?.id, record.id);
  const otherRootPath = await mkdtemp(join(tmpdir(), "dsh-memory-domain-other-"));
  const otherRoot = { ...context, root: otherRootPath, identity: { ...context.identity, rootId: "root:two" } };
  assert.equal((await domain.list(otherRoot, project)).length, 0);
  await assert.rejects(() => domain.open(context, { scope: "shared-project" }), (error: unknown) => error instanceof MemoryStoreError && error.code === "SCOPE_MISMATCH");
  const shared = await domain.open(context, { scope: "shared-project", sharedProject: true });
  assert.equal(shared.records.length, 0);
  await domain.dispose();
});

test("keeps User Memory available without project files and rejects path-shaped user ids", async () => {
  const dshHome = await mkdtemp(join(tmpdir(), "dsh-memory-user-"));
  const domain = new WorkspaceMemoryDomain(dshHome);
  const context = { identity: { sessionId: "session-2", rootId: "root:two" }, root: "/missing-project" };
  const request = { scope: "user" as const, userId: "profile-1" };
  const state = await domain.open(context, request);
  assert.equal(state.records.length, 0);
  await assert.rejects(() => domain.open(context, { scope: "user", userId: "../escape" }), (error: unknown) => error instanceof MemoryStoreError && error.code === "INVALID_RECORD");
  await domain.dispose();
});

test("caches User profiles by identity instead of sharing the active store", async () => {
  const home = await mkdtemp(join(tmpdir(), "dsh-memory-user-domain-"));
  const domain = new WorkspaceMemoryDomain(home);
  const context = { identity: { sessionId: "session-3", rootId: "root:three" }, root: "/missing" };
  const a = { scope: "user" as const, userId: "profile-a" };
  const aState = await domain.open(context, a);
  await domain.upsert(context, a, { scope: aState.scope, scopeKey: aState.scopeKey, type: "fact", title: "A", content: "a", tags: [], provenance: { kind: "user" } });
  const bState = await domain.open(context, { scope: "user", userId: "profile-b" });
  assert.equal(bState.scopeKey, "profile-b");
  assert.equal((await domain.list(context, { scope: "user", userId: "profile-b" })).length, 0);
  assert.equal((await domain.list(context, a)).length, 1);
  await domain.dispose();
});

test("requires optimistic edit identity and quarantines duplicate titles", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-memory-conflict-"));
  const domain = new WorkspaceMemoryDomain(await mkdtemp(join(tmpdir(), "dsh-memory-conflict-home-")));
  const context = { identity: { sessionId: "session-conflict", rootId: "root:conflict" }, root };
  const request = { scope: "project" as const };
  const first = await domain.upsert(context, request, { scope: "project", scopeKey: "root:conflict", type: "fact", title: "Same title", content: "one", tags: [], provenance: { kind: "user" } });
  const duplicate = await domain.upsert(context, request, { scope: "project", scopeKey: "root:conflict", type: "fact", title: " same title ", content: "two", tags: [], provenance: { kind: "user" } });
  assert.equal(duplicate.governance?.verification, "unverified");
  assert.ok(duplicate.governance?.conflictGroup);
  await assert.rejects(() => domain.upsert(context, request, { ...first, id: first.id, provenance: first.provenance, content: "changed" }), (error: unknown) => error instanceof MemoryGovernanceError && error.code === "CONFLICT");
  const changed = await domain.upsert(context, request, { ...first, id: first.id, provenance: first.provenance, content: "changed", expectedRevision: first.governance?.revision ?? 1, expectedHash: first.contentHash });
  assert.equal(changed.content, "changed");
  await domain.dispose();
});
