import test from "node:test";
import assert from "node:assert/strict";

import {
  ActivityProjectionError,
  clearWorkingSet,
  createWorkingSet,
  deriveArtifacts,
  deriveWorkspaceChanges,
  markWorkingSetResolution,
  pinWorkingSet,
  reduceActivity,
  unpinWorkingSet,
} from "../src/domain/activity.ts";
import { startWorkspace } from "../src/domain/workspace.ts";

const identity = { sessionId: "session-activity", rootId: "root:test" };
const baseline = {
  ...startWorkspace({ sessionId: identity.sessionId, processCwd: "/tmp", configuredRoot: ".", baseline: { source: "git", gitHead: "head", gitStatus: [{ status: " M", path: "existing.ts" }] } }).baseline,
  rootId: identity.rootId,
};

test("folds repeated evidence, preserves deletion, and derives current artifacts", () => {
  const projection = reduceActivity(identity, [
    { id: "read-1", identity, path: "src\\new.ts", kind: "READ", observedAt: 1, source: "durable-tool", attribution: "agent-evidenced" },
    { id: "create-1", identity, path: "src/new.ts", kind: "CREATED", observedAt: 2, source: "durable-tool", attribution: "agent-evidenced", previewable: true },
    { id: "read-1", identity, path: "src/new.ts", kind: "READ", observedAt: 3, source: "durable-tool", attribution: "agent-evidenced" },
  ]);
  assert.equal(projection.evidence.length, 2);
  assert.equal(projection.files.get("src/new.ts")?.observations, 2);
  assert.deepEqual(deriveArtifacts(projection), [{ path: "src/new.ts", createdAt: 2 }]);
  const deleted = reduceActivity(identity, [...projection.evidence, { id: "delete-1", identity, path: "src/new.ts", kind: "DELETED", observedAt: 4, source: "git", attribution: "session-observed" }]);
  assert.equal(deleted.files.get("src/new.ts")?.current, "deleted");
  assert.equal(deriveArtifacts(deleted).length, 0);
  assert.equal(deleted.evidence.length, 3);
  const outOfOrder = reduceActivity(identity, [
    { id: "newer", identity, path: "later.ts", kind: "MODIFIED", observedAt: 5, source: "filesystem", attribution: "session-observed" },
    { id: "older", identity, path: "later.ts", kind: "DELETED", observedAt: 4, source: "filesystem", attribution: "unknown" },
  ]);
  assert.equal(outOfOrder.files.get("later.ts")?.current, "present");
});

test("classifies baseline, post-baseline, and non-Git changes", () => {
  assert.deepEqual(deriveWorkspaceChanges(identity, baseline, [
    { path: "existing.ts", status: " M" },
    { path: "new.ts", status: "??" },
  ]).map((item) => item.attribution), ["pre-existing", "session-observed"]);
  const unknown = { ...baseline, source: "unknown" as const, gitStatus: undefined };
  assert.equal(deriveWorkspaceChanges(identity, unknown, [{ path: "new.ts", status: "?" }])[0]?.attribution, "unknown");
});

test("working set is ordered, duplicate-free, identity-scoped, and unresolved until cleared", () => {
  let state = createWorkingSet(identity, 2);
  state = pinWorkingSet(state, "a.ts");
  state = pinWorkingSet(state, "a.ts");
  state = pinWorkingSet(state, "b.ts");
  assert.deepEqual(state.entries.map((entry) => entry.path), ["a.ts", "b.ts"]);
  assert.throws(() => pinWorkingSet(state, "c.ts"), ActivityProjectionError);
  const projection = reduceActivity(identity, [{ id: "delete-a", identity, path: "a.ts", kind: "DELETED", observedAt: 1, source: "filesystem", attribution: "unknown" }]);
  state = markWorkingSetResolution(state, projection);
  assert.equal(state.entries[0]?.unresolved, true);
  state = unpinWorkingSet(state, "a.ts");
  state = pinWorkingSet(state, "renamed-old.ts");
  const changes = deriveWorkspaceChanges(identity, baseline, [{ path: "renamed-new.ts", previousPath: "renamed-old.ts", status: "R  renamed-new.ts" }]);
  state = markWorkingSetResolution(state, projection, changes);
  assert.equal(state.entries[1]?.unresolved, true);
  assert.deepEqual(clearWorkingSet(state).entries, []);
  assert.throws(() => markWorkingSetResolution(state, { ...projection, identity: { ...identity, sessionId: "other" } }), ActivityProjectionError);
});
