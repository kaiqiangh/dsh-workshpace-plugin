import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { createWorkspaceChangesSurfaceComponent, matchesFilter } from "../src/web/workspace-changes-surface.ts";

test("matchesFilter selects the right changes for each filter", () => {
  const change = (path: string, status: string, staged: boolean) => ({ path, status, staged });
  const changes = [
    change("a.ts", "added", true),
    change("b.ts", "modified", false),
    change("c.ts", "deleted", false),
    change("d.txt", "untracked", false),
    change("e.ts", "added", false),
  ];
  assert.equal(matchesFilter(changes[0]!, "all"), true);
  assert.deepEqual(changes.filter((c) => matchesFilter(c, "staged")).map((c) => c.path), ["a.ts"]);
  assert.deepEqual(changes.filter((c) => matchesFilter(c, "added")).map((c) => c.path), ["a.ts", "e.ts"]);
  assert.deepEqual(changes.filter((c) => matchesFilter(c, "modified")).map((c) => c.path), ["b.ts"]);
  assert.deepEqual(changes.filter((c) => matchesFilter(c, "deleted")).map((c) => c.path), ["c.ts"]);
  assert.deepEqual(changes.filter((c) => matchesFilter(c, "untracked")).map((c) => c.path), ["d.txt"]);
});

function remoteFor(changes: readonly { readonly path: string; readonly status: string; readonly staged: boolean; readonly previousPath?: string }[]) {
  return {
    gitStatus: async () => ({ ok: true, value: changes }),
    gitDiff: async () => ({
      ok: true,
      value: { path: changes[0]?.path, staged: "diff --git a/example.md b/example.md\n+added", unstaged: "", truncated: false },
    }),
  };
}

test("renders a degraded notice instead of nothing without an active session", () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([]), {});
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, {})); });
  const texts = tree.root.findAllByType("p").map((node) => node.children.join(""));
  assert.ok(texts.includes("Git changes require an active Harness session."));
});

test("renders status badges and a count for git changes", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "example.md", status: "added", staged: true },
    { path: "notes.txt", status: "modified", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const countBadges = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "count-badge").map((node) => node.children.join(""));
  assert.ok(countBadges.includes("2 changes"));
  const statusBadges = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-status-badge").map((node) => node.children.join(""));
  assert.ok(statusBadges.includes("A"));
  assert.ok(statusBadges.includes("M"));
  const items = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-item");
  assert.equal(items.length, 2);
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff").length >= 1);
});

test("renders an empty state when the working tree is clean", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const texts = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "empty-state").map((node) => node.children.join(""));
  assert.ok(texts.some((text) => text.includes("No changes in the working tree.")));
});
