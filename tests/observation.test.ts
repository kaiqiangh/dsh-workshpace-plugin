import test from "node:test";
import assert from "node:assert/strict";

import { ActivityProjectionError, recordActivity, reduceActivity } from "../src/domain/activity.ts";
import {
  DebouncedReconciliationQueue,
  SessionActivityObserver,
  observeLiveTool,
  reconcileSnapshot,
  summarizeActivity,
} from "../src/domain/observation.ts";
import type { SessionBaseline, WorkspacePath } from "../src/domain/workspace.ts";

const identity = { sessionId: "session-observation", rootId: "root:observation" };
const baseline: SessionBaseline = {
  sessionId: identity.sessionId,
  rootId: identity.rootId,
  capturedAt: 1,
  source: "git",
  gitHead: "head",
  gitStatus: [{ status: " M", path: "existing.ts" as WorkspacePath }],
};

test("classifies final direct tool results without reading narration", () => {
  const read = observeLiveTool({
    identity, callId: "read-1", tool: "read_file", arguments: { path: "src/a.ts" },
    result: { value: { text: "ok" } }, ok: true, observedAt: 1,
  });
  const create = observeLiveTool({
    identity, callId: "write-1", tool: "write_file", arguments: { path: "src/new.ts" },
    result: { value: { created: true } }, ok: true, observedAt: 2,
  });
  const update = observeLiveTool({
    identity, callId: "write-2", tool: "write_file", arguments: { path: "src/new.ts" },
    result: { value: { created: false } }, ok: true, observedAt: 3,
  });
  const replace = observeLiveTool({
    identity, callId: "edit-1", tool: "structured_editor", arguments: { path: "src/new.ts", operation: "replace" },
    result: { value: { accepted: true } }, ok: true, observedAt: 4,
  });
  assert.deepEqual(read.observations.map((item) => item.kind), ["READ"]);
  assert.deepEqual(create.observations.map((item) => item.kind), ["CREATED"]);
  assert.deepEqual(update.observations.map((item) => item.kind), ["MODIFIED"]);
  assert.deepEqual(replace.observations.map((item) => item.kind), ["MODIFIED"]);
  assert.equal(read.observations[0]?.attribution, "agent-evidenced");
  assert.equal(read.observations[0]?.source, "live-tool");
});

test("queues shell failures and background settlement for debounced reconciliation", () => {
  const flushed: number[] = [];
  const queue = new DebouncedReconciliationQueue(1000, (requests) => flushed.push(requests.length));
  const observer = new SessionActivityObserver(identity, baseline, queue);
  const failure = observer.consumeLive({
    identity, callId: "shell-1", tool: "shell", arguments: { command: "generate" },
    result: { error: "exit 1" }, ok: false, observedAt: 1,
  });
  assert.equal(failure.reconciliation?.reason, "failed-call");
  assert.equal(queue.pending().length, 1);
  const launch = observer.consumeLive({
    identity, callId: "job-1", tool: "bash", arguments: { command: "background" },
    result: { value: { started: true } }, ok: true, background: true, observedAt: 2,
  });
  assert.equal(launch.reconciliation, undefined);
  const settlement = observer.consumeLive({
    identity, callId: "job-1", tool: "bash", arguments: { command: "background" },
    result: { value: { exitCode: 0 } }, ok: true, background: true, settled: true, observedAt: 3,
  });
  assert.equal(settlement.reconciliation?.reason, "background-settled");
  assert.equal(queue.pending().length, 1);
  assert.equal(queue.flush().length, 1);
  assert.deepEqual(flushed, [1]);
  queue.dispose();
});

test("reconciles baseline, post-baseline, rename, and non-Git uncertainty", () => {
  const git = reconcileSnapshot(identity, {
    ...baseline,
    gitStatus: [...(baseline.gitStatus ?? []), { status: " M", path: "renamed-old.ts" as WorkspacePath }],
  }, {
    id: "git-1", source: "git", observedAt: 10,
    entries: [
      { path: "existing.ts", status: " M" },
      { path: "new.ts", status: "??", previewable: true },
      { path: "renamed-new.ts", previousPath: "renamed-old.ts", status: "R  " },
    ],
  });
  assert.deepEqual(git.map((item) => [item.path, item.kind, item.attribution]), [
    ["existing.ts", "MODIFIED", "pre-existing"],
    ["new.ts", "CREATED", "session-observed"],
    ["renamed-old.ts", "DELETED", "pre-existing"],
    ["renamed-new.ts", "CREATED", "session-observed"],
  ]);
  const filesystem = reconcileSnapshot(identity, baseline, {
    id: "fs-1", source: "filesystem", observedAt: 11,
    entries: [{ path: "generated.txt", exists: true }],
  });
  assert.equal(filesystem[0]?.attribution, "unknown");
});

test("folds durable records once, then consumes incremental live evidence", () => {
  const observer = new SessionActivityObserver(identity, baseline);
  const durable = [
    { seq: 2, type: "tool/result", time: 2, data: { tool: "write_file", callId: "durable-write", arguments: { path: "created.ts" }, result: { value: { created: true } }, ok: true } },
    { seq: 1, type: "tool/result", time: 1, data: { tool: "read_file", callId: "durable-read", arguments: { path: "existing.ts" }, result: { value: "ok" }, ok: true } },
    { seq: 3, type: "assistant/narration", time: 3, data: { text: "I changed narration-only.ts" } },
  ];
  observer.resume(durable);
  observer.resume(durable);
  assert.deepEqual(observer.projection.evidence.map((item) => item.id), [
    "durable:session-observation:1:0:existing.ts",
    "durable:session-observation:2:0:created.ts",
  ]);
  observer.consumeLive({
    identity, callId: "durable-read", tool: "read_file", arguments: { path: "existing.ts" },
    result: { value: "ok" }, ok: true, observedAt: 4,
  });
  assert.equal(observer.projection.evidence.length, 2);
  observer.consumeLive({
    identity, callId: "live-read", tool: "read_image", arguments: { path: "image.png" },
    result: { value: { mime: "image/png" } }, ok: true, observedAt: 4,
  });
  observer.consumeLive({
    identity, callId: "live-read", tool: "read_image", arguments: { path: "image.png" },
    result: { value: { mime: "image/png" } }, ok: true, observedAt: 4,
  });
  assert.equal(observer.projection.evidence.length, 3);
  assert.equal(observer.projection.files.get("image.png")?.attribution, "agent-evidenced");
  observer.dispose();
});

test("rejects live outcomes from another Workspace identity", () => {
  const observer = new SessionActivityObserver(identity, baseline);
  assert.throws(() => observer.consumeLive({
    identity: { sessionId: "other-session", rootId: identity.rootId },
    callId: "other-call", tool: "shell", result: { error: "failed" }, ok: false, observedAt: 1,
  }), ActivityProjectionError);
  assert.throws(() => observer.consumeLive({
    identity, callId: "", tool: "read_file", arguments: { path: "missing-id.ts" },
    result: { value: "ignored" }, ok: true, observedAt: 2,
  }), ActivityProjectionError);
  observer.dispose();
});

test("coalesces summaries while preserving raw occurrence identity", () => {
  const projection = reduceActivity(identity, [
    { id: "read-a", identity, path: "same.ts", kind: "READ", observedAt: 1, source: "live-tool", attribution: "agent-evidenced" },
    { id: "read-b", identity, path: "same.ts", kind: "READ", observedAt: 2, source: "live-tool", attribution: "agent-evidenced" },
  ]);
  assert.deepEqual(summarizeActivity(projection), [{
    path: "same.ts", occurrences: 2, firstObservedAt: 1, lastObservedAt: 2,
    current: "present", attribution: "agent-evidenced",
  }]);
  assert.deepEqual(projection.evidence.map((item) => item.id), ["read-a", "read-b"]);
});

test("direct evidence keeps attribution when a later baseline reconciliation arrives", () => {
  const direct = reduceActivity(identity, [{
    id: "direct-write", identity, path: "existing.ts", kind: "MODIFIED", observedAt: 2,
    source: "live-tool", attribution: "agent-evidenced",
  }]);
  const reconciled = reconcileSnapshot(identity, baseline, {
    id: "git-after", source: "git", observedAt: 3,
    entries: [{ path: "existing.ts", status: " M" }],
  });
  const merged = reconciled.reduce((current, item) => {
    return recordActivity(current, item);
  }, direct);
  assert.equal(merged.files.get("existing.ts")?.attribution, "agent-evidenced");
});
