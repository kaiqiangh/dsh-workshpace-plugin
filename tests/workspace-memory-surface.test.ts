import assert from "node:assert/strict";
import test from "node:test";

import { workspaceMemoryRecordSummary, workspaceMemoryRequest } from "../src/web/workspace-memory-surface.ts";

test("builds explicit scope requests without exposing filesystem paths", () => {
  assert.deepEqual(workspaceMemoryRequest("project", "ignored"), { scope: "project" });
  assert.deepEqual(workspaceMemoryRequest("user", " profile-1 "), { scope: "user", userId: "profile-1" });
  assert.deepEqual(workspaceMemoryRequest("shared-project", "ignored", true), { scope: "shared-project", sharedProject: true });
});

test("renders bounded provenance and hash metadata before review", () => {
  const summary = workspaceMemoryRecordSummary({
    schemaVersion: 1,
    id: "memory:1",
    scope: "project",
    scopeKey: "root:one",
    type: "decision",
    title: "Decision",
    content: "Local",
    tags: [],
    provenance: { kind: "agent", sessionId: "session-1" },
    createdAt: 1,
    updatedAt: 2,
    useCount: 0,
    contentHash: `sha256:${"a".repeat(64)}`,
    status: "active",
  });
  assert.equal(summary, "project · decision · agent/session-1 · sha256:aaaaaaaa · updated 2 · last-used never · used 0");
  assert.doesNotMatch(summary, /root:one/u);
});
