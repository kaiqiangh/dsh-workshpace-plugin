import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

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
  const first = appended[0] as { readonly type: string; readonly data: { readonly id: string; readonly phase: string; readonly summary: { readonly filesTouched: number } } };
  assert.equal(first.type, "workspace/summary");
  assert.equal(first.data.id, "session-1");
  assert.equal(first.data.phase, "start");
  assert.equal(first.data.summary.filesTouched, 2);
  capturedHandler!({ agent });
  t.mock.timers.tick(300);
  assert.equal(appended.length, 2);
  assert.equal((appended[1] as { data: { phase: string } }).data.phase, "update");
  dispose();
});
