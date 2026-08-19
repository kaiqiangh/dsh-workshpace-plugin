import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { GitChange, GitRepoInfo } from "../src/domain/git.ts";
import { createWorkspaceGitSurfaceComponent } from "../src/web/workspace-git-surface.ts";
import { setWorkspaceLocale } from "../src/web/workspace-i18n.ts";

function gitRemoteFor(info: GitRepoInfo, changes: readonly GitChange[]) {
  return {
    gitRepoInfo: async () => ({ ok: true, value: info }),
    gitStatus: async () => ({ ok: true, value: changes }),
    gitDiff: async () => ({ ok: true, value: { staged: "", unstaged: "", truncated: false } }),
    gitHistory: async () => ({ ok: true, value: [] }),
    gitCommit: async () => ({
      ok: true,
      value: { commit: { sha: "a".repeat(40), parents: [], author: "kai", time: 1_700_000_000, subject: "x", decorations: "" }, files: [], diff: "", diffTruncated: false },
    }),
  };
}

const info = (overrides: Partial<GitRepoInfo> = {}): GitRepoInfo => ({ isGit: true, branch: "main", head: "abc1234", ahead: 0, behind: 0, ...overrides });

function renderSurface(remote: ReturnType<typeof gitRemoteFor>) {
  const render = createWorkspaceGitSurfaceComponent(remote, {}, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  return tree;
}

test("renders the repo status header with branch, head, counts, and ahead/behind", async () => {
  const remote = gitRemoteFor(info({ ahead: 1, behind: 2 }), [
    { path: "a.ts", status: "modified", staged: false },
    { path: "b.ts", status: "added", staged: true },
    { path: "c.txt", status: "untracked", staged: false },
  ]);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(remote); });
  await act(async () => {});
  const header = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "git-repo-header");
  assert.equal(header.length, 1);
  const branch = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-branch");
  assert.equal(branch.children.join(""), "main");
  const head = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-head");
  assert.equal(head.children.join(""), "abc1234");
  const aheadBehind = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-ahead-behind");
  assert.equal(aheadBehind.children.join(""), "↑1 ↓2");
  const pills = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "git-count-pill").map((node) => node.children.join(""));
  assert.ok(pills.includes("1 staged"));
  assert.ok(pills.includes("1 unstaged"));
  assert.ok(pills.includes("1 untracked"));
  const dot = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-status-dot");
  assert.equal(dot.props["data-state"], "dirty");
  // The Changes pane is the default and mounts the existing changes surface.
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "changes-surface").length >= 1);
});

test("the Changes/History segmented switch toggles the visible pane", async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(gitRemoteFor(info(), [])); });
  await act(async () => {});
  const segmentButtons = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "git-segment" ? node.findAll((n) => n.type === "button") : []).flat();
  const historyButton = segmentButtons.find((node) => node.children.join("") === "History");
  assert.ok(historyButton, "History segment button exists");
  await act(async () => { historyButton!.props.onClick(); });
  const historyPane = tree.root.find((node) => node.props["data-dsh-workspace-pane"] === "history");
  const changesPane = tree.root.find((node) => node.props["data-dsh-workspace-pane"] === "changes");
  assert.equal(historyPane.props.hidden, false, "History pane becomes visible");
  assert.equal(changesPane.props.hidden, true, "Changes pane is hidden");
  const changesButton = segmentButtons.find((node) => node.children.join("") === "Changes");
  await act(async () => { changesButton!.props.onClick(); });
  assert.equal(tree.root.find((node) => node.props["data-dsh-workspace-pane"] === "changes").props.hidden, false, "Changes pane returns");
});

test("a non-Git workspace renders the centered empty state without spinner or error", async () => {
  const remote = gitRemoteFor(info({ isGit: false, branch: "", head: "" }), []);
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = renderSurface(remote); });
  await act(async () => {});
  const title = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-nongit-title");
  assert.equal(title.children.join(""), "This workspace is not a Git repository.");
  const hint = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-nongit-hint");
  assert.ok(hint.children.join("").includes("Git changes and history are unavailable here."));
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "git-repo-header").length, 0, "no repo header");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "notice").length, 0, "no error notice");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "git-surface").length, 0, "no panes");
});

test("locale swap re-renders the header labels", async () => {
  setWorkspaceLocale("en");
  try {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = renderSurface(gitRemoteFor(info(), [])); });
    await act(async () => {});
    const enStatus = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-status-text").children.join("");
    assert.ok(enStatus.includes("Branch"), "English header shows the branch label");
    await act(async () => { setWorkspaceLocale("zh"); });
    const zhStatus = tree.root.find((node) => node.props["data-dsh-workspace"] === "git-status-text").children.join("");
    assert.ok(zhStatus.includes("分支"), "Chinese header shows the branch label");
    const historyButton = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "git-segment" ? node.findAll((n) => n.type === "button") : []).flat().find((node) => node.children.join("") === "历史");
    assert.ok(historyButton, "segment labels follow the locale");
  } finally {
    setWorkspaceLocale("en");
  }
});

test("requires an active session like the other surfaces", () => {
  const render = createWorkspaceGitSurfaceComponent(gitRemoteFor(info(), []), {}, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, {})); });
  const texts = tree.root.findAllByType("p").map((node) => node.children.join(""));
  assert.ok(texts.includes("Git changes require an active Harness session."));
});
