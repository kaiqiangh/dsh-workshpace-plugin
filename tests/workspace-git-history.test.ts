import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GIT_HISTORY_MAX_COMMITS, GitError, gitCommit, gitHistory, gitRepoInfo, type GitCommit } from "../src/domain/git.ts";
import { buildWorkspaceGitGraph } from "../src/web/workspace-history-surface.ts";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function run(root: string, args: readonly string[]): string {
  return execFileSync("git", [...args], { cwd: root, encoding: "utf8" }).trim();
}

async function repo() {
  const root = await mkdtemp(join(tmpdir(), "dsh-git-history-"));
  run(root, ["init", "-q", "-b", "main"]);
  run(root, ["config", "user.email", "test@example.com"]);
  run(root, ["config", "user.name", "Test"]);
  return root;
}

async function commitFile(root: string, path: string, content: string, message: string): Promise<void> {
  await writeFile(join(root, path), content, "utf8");
  run(root, ["add", path]);
  run(root, ["commit", "-qm", message]);
}

/** Fast synthetic commits via git commit-tree (no working tree churn). */
function commitTree(root: string, parents: readonly string[], message: string): string {
  return run(root, ["commit-tree", EMPTY_TREE, ...parents.flatMap((parent) => ["-p", parent]), "-m", message]);
}

test("gitHistory parses commits newest-first with parents, author, time, subject, decorations", async () => {
  const root = await repo();
  await commitFile(root, "a.txt", "one\n", "first commit");
  await commitFile(root, "b.txt", "two\n", "second commit");
  run(root, ["tag", "v0.1"]);

  const history = await gitHistory(root);
  assert.equal(history.length, 2);
  assert.equal(history[0]?.subject, "second commit");
  assert.equal(history[1]?.subject, "first commit");
  assert.match(history[0]?.sha ?? "", /^[0-9a-f]{40}$/u);
  assert.equal(history[0]?.author, "Test");
  assert.ok(typeof history[0]?.time === "number" && history[0]!.time > 0);
  assert.equal(history[0]?.parents.length, 1);
  assert.equal(history[0]?.parents[0], history[1]?.sha);
  assert.deepEqual(history[1]?.parents, []);
  // The tip commit carries the branch/tag decoration.
  assert.ok((history[0]?.decorations ?? "").includes("HEAD -> main"));
  assert.ok((history[0]?.decorations ?? "").includes("tag: v0.1"));
  await rm(root, { recursive: true, force: true });
});

test("gitHistory applies limit and offset pagination", async () => {
  const root = await repo();
  await commitFile(root, "a.txt", "one\n", "first");
  await commitFile(root, "b.txt", "two\n", "second");
  await commitFile(root, "c.txt", "three\n", "third");

  const all = await gitHistory(root);
  assert.equal(all.length, 3);
  const page = await gitHistory(root, { limit: 2, offset: 1 });
  assert.deepEqual(page.map((commit) => commit.subject), ["second", "first"]);
  await rm(root, { recursive: true, force: true });
});

test("gitHistory localBranches includes commits reachable from other local branches", async () => {
  const root = await repo();
  await commitFile(root, "base.txt", "base\n", "base");
  run(root, ["checkout", "-qb", "feature/graph"]);
  await commitFile(root, "feature.txt", "feature\n", "feature branch commit");
  const featureSha = run(root, ["rev-parse", "HEAD"]);
  run(root, ["checkout", "-q", "main"]);
  await commitFile(root, "main.txt", "main\n", "main branch commit");

  const head = await gitHistory(root);
  const localBranches = await gitHistory(root, { scope: "localBranches" });
  assert.equal(head.some((commit) => commit.sha === featureSha), false);
  assert.ok(localBranches.some((commit) => commit.sha === featureSha));
  assert.ok(localBranches.some((commit) => commit.decorations.includes("feature/graph")));
  await rm(root, { recursive: true, force: true });
});

test("buildWorkspaceGitGraph keeps merge parents on stable lanes", () => {
  const commits: GitCommit[] = [
    { sha: "merge", parents: ["feature", "main"], author: "Test", time: 1, subject: "merge", decorations: "" },
    { sha: "feature", parents: ["base"], author: "Test", time: 1, subject: "feature", decorations: "" },
    { sha: "main", parents: ["base"], author: "Test", time: 1, subject: "main", decorations: "" },
    { sha: "base", parents: [], author: "Test", time: 1, subject: "base", decorations: "" },
  ];
  const graph = buildWorkspaceGitGraph(commits);
  assert.equal(graph.length, commits.length);
  assert.equal(graph[0]?.parentLanes.length, 2);
  assert.equal(graph[1]?.lane, 0);
  assert.equal(graph[2]?.lane, 1);
});

test("gitHistory clamps to GIT_HISTORY_MAX_COMMITS", async () => {
  const root = await repo();
  let sha = commitTree(root, [], "root");
  for (let index = 1; index < GIT_HISTORY_MAX_COMMITS + 25; index += 1) {
    sha = commitTree(root, [sha], `commit ${index}`);
  }
  run(root, ["update-ref", "refs/heads/main", sha]);

  const history = await gitHistory(root);
  assert.equal(history.length, GIT_HISTORY_MAX_COMMITS);
  const limited = await gitHistory(root, { limit: 500 });
  assert.equal(limited.length, GIT_HISTORY_MAX_COMMITS, "requested limits are clamped");
  await rm(root, { recursive: true, force: true });
});

test("gitCommit returns parsed commit, per-file numstat stats, and a unified diff", async () => {
  const root = await repo();
  await commitFile(root, "a.ts", "const one = 1;\n", "add a.ts");
  const rootSha = run(root, ["rev-parse", "HEAD"]);
  await writeFile(join(root, "a.ts"), "const one = 1;\nconst two = 2;\n", "utf8");
  run(root, ["add", "a.ts"]);
  run(root, ["commit", "-qm", "extend a.ts"]);
  const sha = run(root, ["rev-parse", "HEAD"]);
  await commitFile(root, "b.txt", "untouched\n", "unrelated");

  const detail = await gitCommit(root, sha);
  assert.equal(detail.commit.sha, sha);
  assert.equal(detail.commit.subject, "extend a.ts");
  assert.equal(detail.commit.parents.length, 1);
  assert.equal(detail.files.length, 1);
  assert.equal(detail.files[0]?.path, "a.ts");
  assert.equal(detail.files[0]?.additions, 1);
  assert.equal(detail.files[0]?.deletions, 0);
  assert.match(detail.diff, /^diff --git a\/a\.ts b\/a\.ts/mu);
  assert.match(detail.diff, /\+const two = 2;/mu);
  assert.equal(detail.diffTruncated, false);
  const rootDetail = await gitCommit(root, rootSha);
  assert.deepEqual(rootDetail.files.map((file) => [file.path, file.additions, file.deletions]), [["a.ts", 1, 0]]);
  await rm(root, { recursive: true, force: true });
});

test("gitCommit rejects an unknown sha with a typed GitError", async () => {
  const root = await repo();
  await commitFile(root, "a.txt", "x\n", "only");
  await assert.rejects(
    () => gitCommit(root, "0000000000000000000000000000000000000000"),
    (error: unknown) => error instanceof GitError,
  );
  await rm(root, { recursive: true, force: true });
});

test("gitRepoInfo reports branch, short head, and 0/0 without an upstream", async () => {
  const root = await repo();
  await commitFile(root, "a.txt", "x\n", "initial");
  const info = await gitRepoInfo(root);
  assert.equal(info.isGit, true);
  assert.equal(info.branch, "main");
  assert.match(info.head, /^[0-9a-f]{7}$/u);
  assert.equal(info.ahead, 0);
  assert.equal(info.behind, 0);
  await rm(root, { recursive: true, force: true });
});

test("gitRepoInfo reports ahead/behind against the upstream branch", async () => {
  const origin = await mkdtemp(join(tmpdir(), "dsh-git-history-origin-"));
  run(origin, ["init", "-q", "--bare", "-b", "main"]);
  const root = await repo();
  await commitFile(root, "a.txt", "x\n", "initial");
  run(root, ["remote", "add", "origin", origin]);
  run(root, ["push", "-qu", "origin", "main"]);
  await commitFile(root, "a.txt", "x\ny\n", "local ahead 1");
  await commitFile(root, "a.txt", "x\ny\nz\n", "local ahead 2");

  // Advance the upstream via a second clone.
  const clone = await repo();
  run(clone, ["remote", "add", "origin", origin]);
  run(clone, ["fetch", "-q", "origin"]);
  run(clone, ["checkout", "-q", "-b", "main", "origin/main"]);
  run(clone, ["config", "user.email", "test@example.com"]);
  run(clone, ["config", "user.name", "Test"]);
  await writeFile(join(clone, "remote.txt"), "remote\n", "utf8");
  run(clone, ["add", "remote.txt"]);
  run(clone, ["commit", "-qm", "remote ahead 1"]);
  run(clone, ["push", "-q", "origin", "main"]);

  run(root, ["fetch", "-q", "origin"]);
  const info = await gitRepoInfo(root);
  assert.equal(info.isGit, true);
  assert.equal(info.ahead, 2);
  assert.equal(info.behind, 1);
  await rm(root, { recursive: true, force: true });
  await rm(clone, { recursive: true, force: true });
  await rm(origin, { recursive: true, force: true });
});

test("gitRepoInfo returns isGit false outside a repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-git-history-nogit-"));
  const info = await gitRepoInfo(root);
  assert.equal(info.isGit, false);
  assert.equal(info.branch, "");
  assert.equal(info.head, "");
  assert.equal(info.ahead, 0);
  assert.equal(info.behind, 0);
  await rm(root, { recursive: true, force: true });
});

test("gitHistory fails closed outside a repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-git-history-nogit-"));
  await assert.rejects(() => gitHistory(root), (error: unknown) => error instanceof GitError && error.code === "NOT_A_GIT_REPOSITORY");
  await rm(root, { recursive: true, force: true });
});
