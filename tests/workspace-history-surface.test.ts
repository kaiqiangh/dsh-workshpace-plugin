import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { GitCommit, GitCommitResult } from "../src/domain/git.ts";
import { buildWorkspaceGitGraph, createWorkspaceHistorySurfaceComponent } from "../src/web/workspace-history-surface.ts";

function commit(sha: string, subject: string, overrides: Partial<GitCommit> = {}): GitCommit {
  return { sha, parents: [], author: "kai", time: 1_700_000_000, subject, decorations: "", ...overrides };
}

const TWO_HUNK_DIFF = [
  "diff --git a/file.ts b/file.ts",
  "@@ -1,6 +1,6 @@",
  " const a = 1;",
  "-const count = 1;",
  "+const count = 2;",
  " const tail = 1;",
  "@@ -10,6 +10,6 @@",
  "-const old = 1;",
  "+const fresh = 2;",
  " const end = 1;",
  "diff --git a/notes.md b/notes.md",
  "@@ -1,1 +1,4 @@",
  "+# Notes",
  "+- one",
  "+- two",
].join("\n");

function detailFor(c: GitCommit): GitCommitResult {
  return {
    commit: c,
    files: [
      { path: "file.ts", additions: 1, deletions: 1 },
      { path: "notes.md", additions: 3, deletions: 0 },
    ],
    diff: TWO_HUNK_DIFF,
    diffTruncated: false,
  };
}

test("keeps merge parents on distinct graph lanes", () => {
  const rows = buildWorkspaceGitGraph([
    commit("merge", "merge", { parents: ["left", "right"] }),
    commit("left", "left", { parents: ["base"] }),
    commit("right", "right", { parents: ["base"] }),
  ]);
  assert.deepEqual(rows[0]?.parentLanes, [0, 1]);
  assert.equal(rows[0]?.lanes.length, 1);
});

function remoteFor(commits: readonly GitCommit[]) {
  return {
    gitHistory: async () => ({ ok: true, value: commits }),
    gitCommit: async (sha: string) => ({ ok: true, value: detailFor(commits.find((c) => c.sha === sha) ?? commits[0]!) }),
  };
}

function renderSurface(remote: ReturnType<typeof remoteFor>) {
  const render = createWorkspaceHistorySurfaceComponent(remote, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  return tree;
}

test("renders the commit list with short hash, subject, decorations, author, and relative time", async () => {
  const commits = [
    commit("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "feat: introduce history", { decorations: "HEAD -> main, tag: v0.1" }),
    commit("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "fix: initial commit"),
  ];
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(remoteFor(commits)); });
  await act(async () => {});
  const rows = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit");
  assert.equal(rows.length, 2);
  const hashes = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit-hash").map((node) => node.children.join(""));
  assert.ok(hashes.includes("aaaaaaa"), "short hash renders");
  assert.ok(hashes.includes("bbbbbbb"));
  const subjects = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit-subject").map((node) => node.children.join(""));
  assert.ok(subjects.includes("feat: introduce history"));
  const decos = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit-deco").map((node) => node.children.join(""));
  assert.ok(decos.includes("HEAD -> main, tag: v0.1"));
  const meta = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit-meta").map((node) => node.children.join(""));
  assert.ok(meta.some((text) => text.includes("kai ·")), "author and relative time render");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-graph").length, 2);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-scope").length, 1);
});

test("selecting a commit shows the summary block, files-changed, and per-file diff", async () => {
  const commits = [
    commit("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "feat: introduce history", { decorations: "HEAD -> main" }),
    commit("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "fix: initial commit"),
  ];
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(remoteFor(commits)); });
  await act(async () => {});
  // The tip commit is auto-selected; detail loads its summary + diff.
  const summary = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit-detail");
  assert.equal(summary.length, 1);
  const subject = tree.root.find((node) => node.props["data-dsh-workspace"] === "history-detail-subject");
  assert.equal(subject.children.join(""), "feat: introduce history");
  const files = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-file");
  assert.equal(files.length, 2);
  const filePaths = files.map((node) => node.children.find((child) => typeof child === "object" && (child as { props?: { "data-dsh-workspace"?: string } }).props?.["data-dsh-workspace"] === "history-file-path")?.children?.join(""));
  assert.ok(filePaths.includes("file.ts"));
  assert.ok(filePaths.includes("notes.md"));
  // The combined diff is split into per-file sections and rendered as unified rows.
  const diffFiles = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-diff-file");
  assert.equal(diffFiles.length, 2);
  const codeLines = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "diff-code-line");
  assert.ok(codeLines.length > 0, "diff lines render");
  assert.ok(codeLines.some((node) => node.props["data-kind"] === "add"));
  assert.ok(codeLines.some((node) => node.props["data-kind"] === "remove"));

  // Click the older commit and verify the selection moves.
  const older = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "history-commit-select").find((node) => node.children.some((child) => typeof child === "object" && (child as { children?: unknown[] }).children?.join("") === "bbbbbbb"));
  await act(async () => { older!.props.onClick(); });
  await act(async () => {});
  const detail = tree.root.find((node) => node.props["data-dsh-workspace"] === "history-detail-subject");
  assert.equal(detail.children.join(""), "fix: initial commit");
});

test("renders an empty state when the repository has no commits", async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(remoteFor([])); });
  await act(async () => {});
  const empty = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "empty-state").map((node) => node.children.join(""));
  assert.ok(empty.some((text) => text.includes("No commits in this repository yet.")));
});

test("renders a degraded notice when the git remote fails", async () => {
  const remote = {
    gitHistory: async () => { throw new Error("GIT_UNAVAILABLE: git missing"); },
    gitCommit: async () => ({ ok: true, value: detailFor(commit("a", "x")) }),
  };
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(remote); });
  await act(async () => {});
  const notices = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "notice");
  assert.ok(notices.length >= 1);
  assert.equal(notices[0].props["data-dsw-tone"], "error");
});

test("requires an active session like the other surfaces", () => {
  const render = createWorkspaceHistorySurfaceComponent(remoteFor([]), { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, {})); });
  const texts = tree.root.findAllByType("p").map((node) => node.children.join(""));
  assert.ok(texts.includes("Git changes require an active Harness session."));
});
