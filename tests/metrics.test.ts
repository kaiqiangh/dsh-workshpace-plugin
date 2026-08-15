import test from "node:test";
import assert from "node:assert/strict";

import { createLocalMetrics, LocalMetricError } from "../src/domain/metrics.ts";

const identity = { sessionId: "session-1", rootId: "a".repeat(64) } as const;

test("records only aggregate local Workspace metrics per session", () => {
  const metrics = createLocalMetrics(identity);
  metrics.record("workspace-opened");
  metrics.record("preview-opened");
  metrics.record("preview-opened");
  metrics.record("working-set-sent");

  assert.deepEqual(metrics.snapshot(), {
    identity,
    counts: {
      "workspace-opened": 1,
      "preview-opened": 2,
      "artifact-opened": 0,
      "working-set-sent": 1,
      "capability-degraded": 0,
    },
  });
});

test("resets counts without changing session scope", () => {
  const metrics = createLocalMetrics(identity);
  metrics.record("artifact-opened");
  metrics.reset();

  assert.deepEqual(metrics.snapshot().identity, identity);
  assert.equal(metrics.snapshot().counts["artifact-opened"], 0);
});

test("rejects invalid or payload-shaped metric input", () => {
  assert.throws(() => createLocalMetrics({ sessionId: "", rootId: identity.rootId }), LocalMetricError);
  assert.throws(() => createLocalMetrics({ sessionId: "session-1", rootId: "" }), LocalMetricError);
  assert.throws(() => createLocalMetrics({ sessionId: "session-1", rootId: "/tmp/private" }), LocalMetricError);
  const metrics = createLocalMetrics(identity);
  assert.throws(() => metrics.record("/home/user/private.txt"), LocalMetricError);
  assert.throws(() => metrics.record(null as never), LocalMetricError);
  assert.throws(() => metrics.record(Symbol("path") as never), LocalMetricError);
});

test("keeps metrics isolated by Workspace identity", () => {
  const first = createLocalMetrics(identity);
  const second = createLocalMetrics({ sessionId: "session-1", rootId: "b".repeat(64) });
  first.record("workspace-opened");

  assert.equal(first.snapshot().counts["workspace-opened"], 1);
  assert.equal(second.snapshot().counts["workspace-opened"], 0);
});

test("snapshots only the immutable opaque identity", () => {
  const source = { sessionId: "session-1", rootId: identity.rootId, path: "/private" } as { sessionId: string; rootId: string; path: string };
  const metrics = createLocalMetrics(source);
  source.rootId = "b".repeat(64);

  assert.deepEqual(metrics.snapshot().identity, identity);
  assert.equal("path" in metrics.snapshot().identity, false);
});
