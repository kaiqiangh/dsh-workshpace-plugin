import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { createWorkspaceChangesSurfaceComponent, matchesFilter } from "../src/web/workspace-changes-surface.ts";
import { twoHunkDiffText } from "./fixtures.ts";

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

test("renders inter-hunk context as an expander and reveals lines on click", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(twoHunkDiffText()), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const expander = tree.root.find((node) => node.props["data-dsh-workspace"] === "diff-expander");
  assert.ok(expander, "a collapsed gap renders an expander");
  const button = expander.find((node) => node.type === "button");
  assert.ok(button.children.join("").includes("1 hidden line"), "the hidden middle is the hunk header");
  const before = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line").length;
  await act(async () => { button.props.onClick(); });
  const after = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line").length;
  assert.ok(after > before, "expanding reveals the hunk header");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-expander").length, 0, "the 1-unit middle is fully revealed by the 20-line step");
});

test("sticky file header carries collapse chevron, stats, and prev/next navigation", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "a.ts", status: "modified", staged: false },
    { path: "b.ts", status: "modified", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const header = tree.root.find((node) => node.props["data-dsh-workspace"] === "diff-file-header");
  assert.ok(header, "sticky file header exists");
  assert.ok(header.find((node) => node.props["data-dsh-workspace"] === "diff-collapse"), "collapse chevron exists");
  assert.ok(header.find((node) => node.props["data-dsh-workspace"] === "diff-prev"), "prev button exists");
  assert.ok(header.find((node) => node.props["data-dsh-workspace"] === "diff-next"), "next button exists");
  assert.ok(header.find((node) => node.props["data-dsh-workspace"] === "diff-stats"), "stats exist");
});

test("chevron collapses and re-expands the file diff", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(twoHunkDiffText()), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const chevron = tree.root.find((node) => node.props["data-dsh-workspace"] === "diff-collapse");
  await act(async () => { chevron.props.onClick(); });
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code").length, 0, "diff body hidden when collapsed");
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "empty-state").length >= 1, "collapsed notice shown");
  const chevronAgain = tree.root.find((node) => node.props["data-dsh-workspace"] === "diff-collapse");
  await act(async () => { chevronAgain.props.onClick(); });
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code").length >= 1, "diff body returns after re-expanding");
});

test("prev/next buttons step through files in the active filter and wrap", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "a.ts", status: "modified", staged: false },
    { path: "b.ts", status: "modified", staged: false },
    { path: "c.ts", status: "modified", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const click = async (node: () => TestRenderer.ReactTestInstance | undefined): Promise<void> => {
    // The diff header unmounts briefly while the next file's diff loads, so
    // re-resolve the button after every action instead of holding a stale node.
    const button = node();
    assert.ok(button, "nav button present");
    await act(async () => { button!.props.onClick(); });
    await act(async () => {});
  };
  await click(() => tree.root.findAll((n) => n.props["data-dsh-workspace"] === "diff-next")[0]);
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("b.ts")).length >= 1, "next selects b.ts");
  await click(() => tree.root.findAll((n) => n.props["data-dsh-workspace"] === "diff-next")[0]);
  await click(() => tree.root.findAll((n) => n.props["data-dsh-workspace"] === "diff-next")[0]);
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("a.ts")).length >= 1, "navigation wraps to a.ts");
  await click(() => tree.root.findAll((n) => n.props["data-dsh-workspace"] === "diff-prev")[0]);
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("c.ts")).length >= 1, "prev wraps back to c.ts");
});

test("bracket keys navigate files only when the surface has focus", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "a.ts", status: "modified", staged: false },
    { path: "b.ts", status: "modified", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const section = tree.root.find((node) => node.props["data-dsh-workspace"] === "changes");
  const prevented: string[] = [];
  await act(async () => { section.props.onKeyDown({ key: "]", preventDefault: () => prevented.push("]") }); });
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("b.ts")).length >= 1, "] moves to b.ts");
  assert.deepEqual(prevented, ["]"], "the host never sees the key");
  await act(async () => { section.props.onKeyDown({ key: "[", preventDefault: () => prevented.push("[") }); });
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("a.ts")).length >= 1, "[ moves back to a.ts");
  const before = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("a.ts")).length;
  await act(async () => { section.props.onKeyDown({ key: "ArrowDown", preventDefault: () => prevented.push("ArrowDown") }); });
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-diff" && node.props["aria-label"]?.includes("a.ts")).length, before, "unrelated keys pass through");
  assert.ok(!prevented.includes("ArrowDown"));
});

test("split toggle appears only on wide carriers and switches the diff layout", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(twoHunkDiffText()), { refreshMs: 0, carrierWidth: 1000 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const toggle = tree.root.find((node) => node.props["data-dsh-workspace"] === "diff-mode-toggle");
  assert.ok(toggle, "toggle visible above the breakpoint");
  // Auto mode on a wide carrier is split (VS Code-style); the toggle lets the
  // user override toward unified.
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-split").length, 1, "wide carriers default to split");
  const unifiedBtn = toggle.find((node) => node.children?.join("") === "Unified");
  await act(async () => { unifiedBtn.props.onClick(); });
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-split").length, 0, "back to unified");
});

test("split toggle is hidden on narrow carriers", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(twoHunkDiffText()), { refreshMs: 0, carrierWidth: 500 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-mode-toggle").length, 0, "no toggle below the breakpoint");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-split").length, 0, "diff stays unified");
});

test("changed diff on refresh stashes behind a pill instead of reflowing", async () => {
  let diffText = [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
  ].join("\n");
  const remote = {
    gitStatus: async () => ({ ok: true, value: [{ path: "example.md", status: "modified", staged: false }] }),
    gitDiff: async () => ({ ok: true, value: { path: "example.md", staged: diffText, unstaged: "", truncated: false } }),
  };
  const render = createWorkspaceChangesSurfaceComponent(remote, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-refresh-pill").length, 0, "no pill initially");
  const initialLines = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line").length;
  // The diff changed on the next poll.
  diffText = [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,2 +1,2 @@",
    "-old",
    "+old but different",
    "-extra",
    "+new",
  ].join("\n");
  const refresh = tree.root.find((node) => node.children?.join("") === "Refresh");
  await act(async () => { refresh.props.onClick(); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-refresh-pill").length, 1, "pill appears on changed content");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line").length, initialLines, "stale diff is not reflowed");
  const pill = tree.root.find((node) => node.props["data-dsh-workspace"] === "diff-refresh-pill");
  await act(async () => { pill.props.onClick(); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-refresh-pill").length, 0, "pill dismisses after applying");
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line").length > initialLines, "the new diff renders");
});

test("identical diff on refresh stays silent without a pill", async () => {
  const diff = [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
  ].join("\n");
  const render = createWorkspaceChangesSurfaceComponent(remoteForDiff(diff), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const refresh = tree.root.find((node) => node.children?.join("") === "Refresh");
  await act(async () => { refresh.props.onClick(); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-refresh-pill").length, 0, "no pill when the diff is unchanged");
});

test("groups changes into staged / unstaged / untracked sections (ADR #115)", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "staged.ts", status: "added", staged: true },
    { path: "unstaged.ts", status: "modified", staged: false },
    { path: "untracked.txt", status: "untracked", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const groups = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-group");
  assert.equal(groups.length, 3, "one section per group");
  const titles = groups.map((node) => node.children.find((child) => typeof child === "object" && (child as { props?: { "data-dsh-workspace"?: string } }).props?.["data-dsh-workspace"] === "change-group-title")?.children?.join("") ?? "");
  assert.ok(titles.includes("Staged"));
  assert.ok(titles.includes("Unstaged"));
  assert.ok(titles.includes("Untracked"));
  const listRows = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-select").map((node) => node.children.join(""));
  assert.deepEqual(listRows, ["staged.ts", "unstaged.ts", "untracked.txt"]);
});

test("grouped sections omit empty groups", async () => {
  const render = createWorkspaceChangesSurfaceComponent(remoteFor([
    { path: "only-untracked.txt", status: "untracked", staged: false },
  ]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const groups = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "change-group");
  assert.equal(groups.length, 1, "only the non-empty group renders");
});
