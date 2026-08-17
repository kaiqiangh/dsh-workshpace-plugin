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

function remoteForDiff(diff: string, path = "example.md") {
  return {
    gitStatus: async () => ({ ok: true, value: [{ path, status: "modified", staged: false }] }),
    gitDiff: async () => ({ ok: true, value: { path, staged: diff, unstaged: "", truncated: false } }),
  };
}

test("renders a two-column list | detail layout", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "example.md", status: "modified", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "columns").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "column-list").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "column-detail").length, 1);
});

test("highlights intra-line word changes in the diff", async () => {
  const diff = [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,3 +1,3 @@",
    " const a = 1;",
    "-const count = 1;",
    "+const count = 2;",
    " const b = 3;",
  ].join("\n");
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(diff), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const tokens = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-token");
  assert.ok(tokens.length > 0, "word-level tokens are rendered");
  const kinds = new Set(tokens.map((node) => node.props["data-token"]));
  assert.ok(kinds.has("added"));
  assert.ok(kinds.has("removed"));
  assert.ok(kinds.has("equal"));
});

test("falls back to line-level text when the diff is too large for word highlighting", async () => {
  const longLine = "x".repeat(600);
  const diff = [
    "@@ -1,2 +1,2 @@",
    `-${longLine}`,
    `+${longLine}y`,
  ].join("\n");
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(diff), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-token").length, 0, "no word-level tokens when the guard trips");
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line" && node.props["data-kind"] === "add").length >= 1);
});

test("renders a degraded notice when the git remote fails", async () => {
  const remote = {
    gitStatus: async () => { throw new Error("GIT_UNAVAILABLE: git missing"); },
    gitDiff: async () => ({ ok: true, value: { path: "", staged: "", unstaged: "", truncated: false } }),
  };
  const render = createWorkspaceChangesSurfaceComponent(remote, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const notices = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "notice");
  assert.ok(notices.length >= 1, "a notice is shown");
  assert.equal(notices[0].props["data-dsw-tone"], "error");
  const noticeText = notices[0].findAll((node) => node.type === "p").map((node) => node.children.join("")).join("");
  assert.ok(noticeText.includes("Git is not available for this workspace."));
});

test("filter chips narrow the visible change list", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "a.ts", status: "added", staged: true },
    { path: "b.ts", status: "modified", staged: false },
    { path: "c.ts", status: "deleted", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const chips = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "filter-chip");
  assert.ok(chips.map((node) => node.children.join("")).includes("Deleted"));
  const deletedChip = chips.find((node) => node.children.join("") === "Deleted")!;
  await act(async () => { deletedChip.props.onClick(); });
  const selects = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-select");
  assert.equal(selects.length, 1);
  assert.ok(selects[0].children.join("").includes("c.ts"));
});

test("copy button copies the selected diff to the clipboard", async () => {
  const diff = [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,2 +1,2 @@",
    "-old",
    "+new",
  ].join("\n");
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(diff), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  let captured = "";
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async (text: string) => { captured = text; } } },
    configurable: true,
  });
  try {
    await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
    await act(async () => {});
    const copyButton = tree.root.find((node) => node.children?.join("") === "Copy diff");
    await act(async () => { copyButton.props.onClick(); });
    await act(async () => {});
    assert.ok(captured.includes("+new"), "clipboard received the diff text");
  } finally {
    delete (globalThis as { navigator?: unknown }).navigator;
  }
});
