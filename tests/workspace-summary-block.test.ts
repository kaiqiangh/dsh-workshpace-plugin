import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { workspaceSummaryBlockComponent, validSummaryShape, type WorkspaceSummaryRemote } from "../src/web/workspace-summary-block.ts";
import { setWorkspaceLocale, workspaceLocale } from "../src/web/workspace-i18n.ts";
import type { WorkspaceSummaryData } from "../src/host/workspace-summary.ts";

const FULL: WorkspaceSummaryData = {
  filesTouched: 2,
  changes: 2,
  artifacts: 1,
  workspaceName: "repo",
  filesCreated: 1,
  filesModified: 1,
  filesDeleted: 0,
  firstObservedAt: 2,
  lastObservedAt: 4,
  memoryCount: 0,
  decisionCount: 0,
};

// --- pure shape guard -------------------------------------------------------

test("validSummaryShape rejects a partial payload (name only)", () => {
  // The exact broken shape observed in #119: name present, counts absent.
  assert.equal(validSummaryShape({ workspaceName: "Workspace" }), false);
  assert.equal(validSummaryShape({ filesTouched: 2 }), false);
  assert.equal(validSummaryShape(null), false);
  assert.equal(validSummaryShape(undefined), false);
  assert.equal(validSummaryShape("nope"), false);
});

test("validSummaryShape accepts a complete host payload", () => {
  assert.equal(validSummaryShape(FULL), true);
});

test("validSummaryShape rejects a negative or non-integer count", () => {
  assert.equal(validSummaryShape({ ...FULL, filesTouched: -1 }), false);
  assert.equal(validSummaryShape({ ...FULL, filesTouched: 1.5 }), false);
  assert.equal(validSummaryShape({ ...FULL, workspaceName: "" }), false);
});

// --- render (no `undefined` reaches the DOM) --------------------------------

function collectText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  const children = (node as { children?: unknown }).children;
  if (Array.isArray(children)) return children.map(collectText).join("");
  return "";
}

function allText(tree: TestRenderer.ReactTestRenderer): string {
  const json = tree.toJSON();
  if (Array.isArray(json)) return json.map(collectText).join("");
  return collectText(json);
}

async function renderWith(payload: WorkspaceSummaryData | undefined): Promise<TestRenderer.ReactTestRenderer> {
  const remote: WorkspaceSummaryRemote = { workspaceSummary: async () => payload };
  const Comp = workspaceSummaryBlockComponent({ resolveRemote: () => remote, refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(Comp, { useSessions: () => "session-1" })); });
  await act(async () => {});
  return tree;
}

test("renders the metric row from a complete payload (English)", async () => {
  setWorkspaceLocale("en");
  const tree = await renderWith(FULL);
  const text = allText(tree);
  assert.ok(text.includes("repo"), "workspace name is shown");
  assert.ok(text.includes("2 files"), "files count is rendered, not undefined");
  assert.ok(text.includes("1 added"), "created count is rendered, not undefined");
  assert.ok(text.includes("1 modified"), "modified count is rendered, not undefined");
  assert.ok(!text.includes("undefined"), "no 'undefined' leaks into the block");
});

test("renders localized counts when the locale is Chinese", async () => {
  setWorkspaceLocale("zh");
  try {
    const tree = await renderWith(FULL);
    const text = allText(tree);
    assert.ok(text.includes("个文件"), "Chinese file-count copy is used");
    assert.ok(!text.includes("undefined"), "no 'undefined' leaks into the block");
  } finally {
    setWorkspaceLocale("en");
  }
});

test("a partial payload is downgraded to the unavailable state (no undefined)", async () => {
  setWorkspaceLocale("en");
  const tree = await renderWith({ workspaceName: "Workspace" } as unknown as WorkspaceSummaryData);
  const text = allText(tree);
  assert.ok(text.includes("Workspace summary is unavailable"), "unavailable state shown for a garbled payload");
  assert.ok(!text.includes("undefined"), "no 'undefined' leaks into the block");
});

test("a missing payload (undefined) is downgraded to the unavailable state", async () => {
  setWorkspaceLocale("en");
  const tree = await renderWith(undefined);
  const text = allText(tree);
  assert.ok(text.includes("Workspace summary is unavailable"), "unavailable state shown when no summary");
  assert.ok(!text.includes("undefined"), "no 'undefined' leaks into the block");
});

test("locale is English again after the Chinese test cleaned up", () => {
  assert.equal(workspaceLocale(), "en");
});
