import test from "node:test";
import assert from "node:assert/strict";

import { createWorkingSet, pinWorkingSet, markWorkingSetResolution } from "../src/domain/activity.ts";
import { buildWorkingSetMessage, deliverWorkingSet, FollowupDeliveryError } from "../src/domain/followup.ts";

const identity = { sessionId: "followup-session", rootId: "root:followup" };

function workingSet() {
  let state = createWorkingSet(identity, 20);
  state = pinWorkingSet(state, "src/a.ts");
  state = pinWorkingSet(state, "output/report.csv");
  return state;
}

test("builds one deterministic path-only message with unresolved markers", () => {
  const state = markWorkingSetResolution(workingSet(), {
    identity,
    evidence: [{ id: "delete", identity, path: "src/a.ts", kind: "DELETED", observedAt: 1, source: "filesystem", attribution: "unknown" }],
    files: new Map([["src/a.ts", { path: "src/a.ts", firstObservedAt: 1, lastObservedAt: 1, observations: 1, current: "deleted", lastKind: "DELETED", attribution: "unknown", createdInSession: false, previewable: false }]]),
  });
  const message = buildWorkingSetMessage(state, identity);
  assert.equal(message, "Inspect these Workspace Paths as needed; do not assume or inject their contents:\n- src/a.ts (unresolved)\n- output/report.csv");
  assert.equal(message.includes("/Users/"), false);
  assert.equal(message.includes("contents of"), false);
});

test("resolves a fresh running or idle Agent and invokes followup exactly once", async () => {
  for (const status of ["running", "idle"] as const) {
    let lookups = 0;
    let calls = 0;
    let delivered = "";
    const result = await deliverWorkingSet(workingSet(), identity, () => {
      lookups += 1;
      return { identity, status, followup: (message: string) => { calls += 1; delivered = message; } };
    });
    assert.equal(lookups, 1);
    assert.equal(calls, 1);
    assert.equal(result.agentStatus, status);
    assert.equal(delivered, result.message);
  }
});

test("preserves state on missing, stale, and failed delivery without retry", async () => {
  const state = workingSet();
  await assert.rejects(() => deliverWorkingSet(state, identity, () => undefined), (error) => error instanceof FollowupDeliveryError && error.code === "AGENT_UNAVAILABLE");
  await assert.rejects(() => deliverWorkingSet(state, identity, () => ({ identity: { ...identity, rootId: "other" }, status: "idle", followup: () => {} })), (error) => error instanceof FollowupDeliveryError && error.code === "STALE_AGENT");
  let calls = 0;
  await assert.rejects(() => deliverWorkingSet(state, identity, () => ({ identity, status: "idle", followup: () => { calls += 1; throw new Error("queue failed"); } })), (error) => error instanceof FollowupDeliveryError && error.code === "DELIVERY_FAILED");
  assert.equal(calls, 1);
  assert.deepEqual(state.entries.map((entry) => entry.path), ["src/a.ts", "output/report.csv"]);
});

test("rejects invalid, over-limit, duplicate, and cross-identity state before Agent lookup", async () => {
  let lookups = 0;
  const resolve = () => { lookups += 1; return undefined; };
  const invalid = { ...workingSet(), entries: [{ path: "../secret", unresolved: false }] } as never;
  await assert.rejects(() => deliverWorkingSet(invalid, identity, resolve), (error) => error instanceof FollowupDeliveryError && error.code === "INVALID_WORKING_SET");
  const duplicate = { ...workingSet(), entries: [{ path: "src/a.ts", unresolved: false }, { path: "src/a.ts", unresolved: false }] };
  await assert.rejects(() => deliverWorkingSet(duplicate, identity, resolve), (error) => error instanceof FollowupDeliveryError && error.code === "INVALID_WORKING_SET");
  await assert.rejects(() => deliverWorkingSet(workingSet(), { ...identity, sessionId: "other" }, resolve), (error) => error instanceof FollowupDeliveryError && error.code === "WORKSPACE_MISMATCH");
  const overLimit = { ...workingSet(), max: 1 };
  await assert.rejects(() => deliverWorkingSet(overLimit, identity, resolve), (error) => error instanceof FollowupDeliveryError && error.code === "INVALID_WORKING_SET");
  await assert.rejects(() => deliverWorkingSet({ ...workingSet(), entries: undefined } as never, identity, resolve), (error) => error instanceof FollowupDeliveryError && error.code === "INVALID_WORKING_SET");
  await assert.rejects(() => deliverWorkingSet(workingSet(), identity, resolve, Number.NaN), (error) => error instanceof FollowupDeliveryError && error.code === "INVALID_WORKING_SET");
  assert.equal(lookups, 0);
});

test("rejects disposed Agent handles and does not inject file data", async () => {
  let reads = 0;
  await assert.rejects(() => deliverWorkingSet(workingSet(), identity, () => ({
    identity, status: "idle", disposed: true,
    followup: () => { reads += 1; },
  })), (error) => error instanceof FollowupDeliveryError && error.code === "STALE_AGENT");
  assert.equal(reads, 0);
});
