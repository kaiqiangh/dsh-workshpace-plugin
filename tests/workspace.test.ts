import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  normalizeWorkspacePath,
  resumeWorkspace,
  startWorkspace,
  WorkspaceIdentityError,
  WorkspacePathError,
} from "../src/domain/workspace.ts";

const testRoot = mkdtempSync(join("/tmp", "dsh-workspace-"));
mkdirSync(join(testRoot, "project"));
mkdirSync(join(testRoot, "other"));
after(() => rmSync(testRoot, { recursive: true, force: true }));

test("normalizes a relative Workspace Path", () => {
  assert.equal(normalizeWorkspacePath("src\\auth.ts"), "src/auth.ts");
  assert.equal(normalizeWorkspacePath("./src//auth.ts"), "src/auth.ts");
});

test("rejects paths that could escape the Workspace Root", () => {
  for (const path of ["/etc/passwd", "../secret", "C:\\secret.txt"]) {
    assert.throws(() => normalizeWorkspacePath(path), WorkspacePathError);
  }
});

test("starts a Workspace with a canonical root and one baseline", () => {
  const workspace = startWorkspace({
    sessionId: "session-1",
    processCwd: testRoot,
    configuredRoot: "project",
    baseline: { source: "git", gitHead: "abc123", gitStatus: [{ status: " M", path: "README.md" }] },
    capturedAt: 100,
  });

  assert.equal(workspace.identity.sessionId, "session-1");
  assert.match(workspace.identity.rootId, /^root:[0-9a-f]{64}$/);
  assert.doesNotMatch(workspace.identity.rootId, new RegExp(testRoot));
  assert.deepEqual(workspace.baseline, {
    sessionId: "session-1",
    rootId: workspace.identity.rootId,
    capturedAt: 100,
    source: "git",
    gitHead: "abc123",
    gitStatus: [{ status: " M", path: "README.md" }],
    fingerprint: undefined,
    reason: undefined,
  });
});

test("resumes the existing baseline and rejects a root mismatch", () => {
  const workspace = startWorkspace({
    sessionId: "session-2",
    processCwd: testRoot,
    configuredRoot: "project",
    baseline: { source: "unknown", reason: "late initialization" },
    capturedAt: 200,
  });

  assert.deepEqual(
    resumeWorkspace({
      snapshot: workspace,
      sessionId: "session-2",
      processCwd: testRoot,
      configuredRoot: "project",
    }),
    workspace,
  );

  assert.throws(
    () => resumeWorkspace({ snapshot: workspace, sessionId: "session-2", processCwd: testRoot, configuredRoot: "other" }),
    WorkspaceIdentityError,
  );
});

test("keeps configured roots below the process working directory", () => {
  for (const configuredRoot of ["/", "../outside", "C:\\outside"]) {
    assert.throws(
      () => startWorkspace({ sessionId: "session-3", processCwd: testRoot, configuredRoot }),
      WorkspaceIdentityError,
    );
  }
});
