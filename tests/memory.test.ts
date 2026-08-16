import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceMemoryDomain } from "../src/domain/memory.ts";
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
