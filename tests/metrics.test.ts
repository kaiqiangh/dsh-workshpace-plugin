import test from "node:test";
import assert from "node:assert/strict";

import { createLocalMetrics, LocalMetricError } from "../src/domain/metrics.ts";

test("records only aggregate local Workspace metrics per session", () => {
  const metrics = createLocalMetrics("session-1");
  metrics.record("workspace-opened");
  metrics.record("preview-opened");
  metrics.record("preview-opened");
  metrics.record("working-set-sent");

  assert.deepEqual(metrics.snapshot(), {
    sessionId: "session-1",
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
  const metrics = createLocalMetrics("session-1");
  metrics.record("artifact-opened");
  metrics.reset();

  assert.equal(metrics.snapshot().sessionId, "session-1");
  assert.equal(metrics.snapshot().counts["artifact-opened"], 0);
});

test("rejects invalid or payload-shaped metric input", () => {
  assert.throws(() => createLocalMetrics(""), LocalMetricError);
  const metrics = createLocalMetrics("session-1");
  assert.throws(() => metrics.record("/home/user/private.txt"), LocalMetricError);
  assert.throws(() => metrics.record(null as never), LocalMetricError);
});
