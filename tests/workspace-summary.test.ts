import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import { WorkspaceMemoryDomain } from "../src/domain/memory.ts";
import { startWorkspace } from "../src/domain/workspace.ts";
import { attachWorkspaceSummaryEmitter, workspaceSummaryFor, workspaceSummaryWithMemory } from "../src/host/workspace-summary.ts";

async function root() {
  return mkdtemp(join(tmpdir(), "dsh-summary-"));
}

function events() {
  return [
    {
      seq: 1,
      type: "tool/call",
      data: { callId: "call-1", name: "write_file", arguments: JSON.stringify({ file_path: "out/report.md", content: "x" }) },
    },
    {
      seq: 2,
      type: "tool/result",
      data: {
        message: {
          source: { callId: "call-1" },
          content: [{ type: "text", text: "Created file out/report.md" }],
        },
      },
    },
    {
      seq: 3,
      type: "tool/call",
      data: { callId: "call-2", name: "write_file", arguments: JSON.stringify({ file_path: "out/data.json", content: "{}" }) },
    },
    {
      seq: 4,
      type: "tool/result",
      data: {
        message: {
          source: { callId: "call-2" },
          content: [{ type: "text", text: "Updated file out/data.json" }],
        },
      },
    },
  ];
}

test("computes a deterministic summary from durable tool records", async () => {
  const cwd = await root();
  const summary = workspaceSummaryFor({ id: "session-1", session: { header: { cwd }, events: events() } });
  assert.ok(summary);
  assert.equal(summary.filesTouched, 2);
  assert.equal(summary.changes, 2);
  // Only the created report.md is an artifact; the updated data.json is not.
  assert.equal(summary.artifacts, 1);
  assert.equal(summary.workspaceName, basename(cwd));
  // Enriched trajectory fields: durable tool records carry seq-based timestamps.
  assert.equal(summary.filesCreated, 1);
  assert.equal(summary.filesModified, 1);
  assert.equal(summary.filesDeleted, 0);
  assert.equal(summary.firstObservedAt, 2);
  assert.equal(summary.lastObservedAt, 4);
  // Memory/decision counts are attached by the with-memory wrapper; the pure summary stays 0.
  assert.equal(summary.memoryCount, 0);
  assert.equal(summary.decisionCount, 0);
});

test("returns undefined for sessions without a usable cwd", () => {
  assert.equal(workspaceSummaryFor({ id: "session-1", session: {} }), undefined);
  assert.equal(workspaceSummaryFor({ id: "session-1" }), undefined);
});

test("the v0.6 emitter is a no-op and never appends a workspace/summary event", () => {
  // v0.6 removed the durable workspace/summary event: persisting a custom
  // event made the whole session log unloadable after a restart (cold-read
  // rejects unknown non-ignorable types — wayfinder #110). The emitter now
  // performs no log writes; the summary is derived on demand instead.
  let registered: string | undefined;
  const ctx = {
    on: (name: string, _handler: (exec: unknown) => void) => {
      registered = name;
    },
  };
  const dispose = attachWorkspaceSummaryEmitter(ctx as never);
  assert.equal(registered, undefined, "the v0.6 emitter registers no tools/result observer");
  dispose();
});

test("workspaceSummaryWithMemory attaches session-scope memory and decision counts", async () => {
  const dshHome = await mkdtemp(join(tmpdir(), "dsh-summary-home-"));
  const memoryDomain = new WorkspaceMemoryDomain(join(dshHome, "home"));
  const cwd = await root();
  const identity = startWorkspace({ sessionId: "session-1", processCwd: cwd }).identity;
  const context = { identity, root: cwd };
  const request = { scope: "session" as const };
  await memoryDomain.upsert(context, request, {
    scope: "session",
    scopeKey: `${identity.sessionId}|${identity.rootId}`,
    type: "fact",
    title: "Session fact",
    content: "counted fact",
    tags: [],
    provenance: { kind: "tool", sessionId: "session-1" },
  });
  await memoryDomain.upsert(context, request, {
    scope: "session",
    scopeKey: `${identity.sessionId}|${identity.rootId}`,
    type: "decision",
    title: "Session decision",
    content: "counted decision",
    tags: [],
    provenance: { kind: "tool", sessionId: "session-1" },
  });
  const agent = {
    id: "session-1",
    session: { header: { cwd }, events: events() },
  };
  const summary = await workspaceSummaryWithMemory(agent, memoryDomain);
  assert.ok(summary);
  assert.equal(summary.memoryCount, 2);
  assert.equal(summary.decisionCount, 1);
  // The base trajectory facts are preserved.
  assert.equal(summary.filesTouched, 2);
  await memoryDomain.dispose();
});

test("workspaceSummaryWithMemory degrades to the base summary without a Memory domain", async () => {
  const cwd = await root();
  const agent = { id: "session-1", session: { header: { cwd }, events: events() } };
  const summary = await workspaceSummaryWithMemory(agent);
  assert.ok(summary);
  assert.equal(summary.memoryCount, 0);
  assert.equal(summary.decisionCount, 0);
});
