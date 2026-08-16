import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import { WorkspaceMemoryDomain } from "../src/domain/memory.ts";
import { startWorkspace } from "../src/domain/workspace.ts";
import { attachWorkspaceSummaryEmitter, workspaceSummaryFor } from "../src/host/workspace-summary.ts";

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
  // Memory/decision counts are attached by the emitter; the pure summary stays 0.
  assert.equal(summary.memoryCount, 0);
  assert.equal(summary.decisionCount, 0);
});

test("returns undefined for sessions without a usable cwd", () => {
  assert.equal(workspaceSummaryFor({ id: "session-1", session: {} }), undefined);
  assert.equal(workspaceSummaryFor({ id: "session-1" }), undefined);
});

test("emits a debounced workspace/summary event per session on tools/result", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const appended: { readonly type: string; readonly data: unknown }[] = [];
  const ctx = {
    on: (name: string, handler: (exec: unknown) => void) => {
      assert.equal(name, "tools/result");
      capturedHandler = handler;
    },
  };
  let capturedHandler: ((exec: unknown) => void) | undefined;
  const dispose = attachWorkspaceSummaryEmitter(ctx as never);
  const cwd = await root();
  const agent = {
    id: "session-1",
    session: {
      header: { cwd },
      events: events(),
      append: (type: string, data: unknown) => { appended.push({ type, data }); },
    },
  };
  capturedHandler!({ agent });
  assert.equal(appended.length, 0);
  t.mock.timers.tick(300);
  assert.equal(appended.length, 1);
  const first = appended[0] as { readonly type: string; readonly data: { readonly id: string; readonly phase: string; readonly summary: { readonly filesTouched: number; readonly filesCreated: number; readonly filesModified: number; readonly filesDeleted: number; readonly firstObservedAt: number; readonly lastObservedAt: number; readonly memoryCount: number; readonly decisionCount: number } } };
  assert.equal(first.type, "workspace/summary");
  assert.equal(first.data.id, "session-1");
  assert.equal(first.data.phase, "start");
  assert.equal(first.data.summary.filesTouched, 2);
  assert.equal(first.data.summary.filesCreated, 1);
  assert.equal(first.data.summary.filesModified, 1);
  assert.equal(first.data.summary.filesDeleted, 0);
  assert.equal(first.data.summary.firstObservedAt, 2);
  assert.equal(first.data.summary.lastObservedAt, 4);
  assert.equal(first.data.summary.memoryCount, 0);
  assert.equal(first.data.summary.decisionCount, 0);
  capturedHandler!({ agent });
  t.mock.timers.tick(300);
  assert.equal(appended.length, 2);
  assert.equal((appended[1] as { data: { phase: string } }).data.phase, "update");
  dispose();
});

test("attaches session-scope memory and decision counts when a Memory domain is supplied", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
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
  const appended: { readonly type: string; readonly data: { readonly summary: { readonly memoryCount: number; readonly decisionCount: number } } }[] = [];
  const ctx = {
    on: (name: string, handler: (exec: unknown) => void) => {
      assert.equal(name, "tools/result");
      capturedHandler = handler;
    },
  };
  let capturedHandler: ((exec: unknown) => void) | undefined;
  const dispose = attachWorkspaceSummaryEmitter(ctx as never, memoryDomain);
  const agent = {
    id: "session-1",
    session: {
      header: { cwd },
      events: events(),
      append: (type: string, data: unknown) => { appended.push({ type, data } as never); },
    },
  };
  capturedHandler!({ agent });
  t.mock.timers.tick(300);
  // The emitter augments the summary asynchronously; drain the event loop.
  for (let attempt = 0; attempt < 100 && appended.length === 0; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(appended.length, 1);
  assert.equal(appended[0]!.data.summary.memoryCount, 2);
  assert.equal(appended[0]!.data.summary.decisionCount, 1);
  dispose();
  await memoryDomain.dispose();
});
