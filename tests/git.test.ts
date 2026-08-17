import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GitError, gitDiff, gitStatus, parsePorcelain } from "../src/domain/git.ts";
import { parseUnifiedDiff } from "../src/web/workspace-diff.ts";

function run(root: string, args: readonly string[]): string {
  return execFileSync("git", [...args], { cwd: root, encoding: "utf8" }).trim();
}

async function repo() {
  const root = await mkdtemp(join(tmpdir(), "dsh-git-"));
  run(root, ["init", "-q"]);
  run(root, ["config", "user.email", "test@example.com"]);
  run(root, ["config", "user.name", "Test"]);
  return root;
}

test("parses porcelain status into typed changes", () => {
  const changes = parsePorcelain(" M src/a.ts\0A  out/new.json\0?? untracked.txt\0R  old.md\0new.md\0");
  const modified = changes.find((c) => c.path === "src/a.ts");
  assert.equal(modified?.status, "modified");
  assert.equal(modified?.staged, false);
  const added = changes.find((c) => c.path === "out/new.json");
  assert.equal(added?.status, "added");
  assert.equal(added?.staged, true);
  const untracked = changes.find((c) => c.path === "untracked.txt");
  assert.equal(untracked?.status, "untracked");
  const renamed = changes.find((c) => c.path === "new.md");
  assert.equal(renamed?.status, "renamed");
  assert.equal(renamed?.previousPath, "old.md");
});

test("gitStatus lists working-tree and staged changes", async () => {
  const root = await repo();
  await writeFile(join(root, "a.ts"), "one\n", "utf8");
  await writeFile(join(root, "keep.txt"), "keep\n", "utf8");
  run(root, ["add", "."]);
  run(root, ["commit", "-qm", "init"]);
  await writeFile(join(root, "a.ts"), "two\n", "utf8");
  await writeFile(join(root, "added.ts"), "new\n", "utf8");
  await writeFile(join(root, "untracked.txt"), "x\n", "utf8");
  run(root, ["add", "added.ts"]);

  const changes = await gitStatus(root);
  assert.ok(changes.some((c) => c.path === "a.ts" && c.status === "modified" && !c.staged));
  assert.ok(changes.some((c) => c.path === "added.ts" && c.status === "added" && c.staged));
  assert.ok(changes.some((c) => c.path === "untracked.txt" && c.status === "untracked"));
});

test("gitDiff returns staged and unstaged unified diffs for one path", async () => {
  const root = await repo();
  await writeFile(join(root, "a.ts"), "one\n", "utf8");
  run(root, ["add", "."]);
  run(root, ["commit", "-qm", "init"]);
  await writeFile(join(root, "a.ts"), "one\n// changed\n", "utf8");
  run(root, ["add", "a.ts"]);
  await writeFile(join(root, "a.ts"), "one\n// changed\n// unstaged\n", "utf8");

  const diff = await gitDiff(root, "a.ts");
  assert.equal(diff.path, "a.ts");
  assert.match(diff.staged, /\+.*changed/u);
  assert.match(diff.unstaged, /\+.*unstaged/u);
});

test("gitDiff rejects paths outside the workspace", async () => {
  const root = await repo();
  await assert.rejects(() => gitDiff(root, "../etc/passwd"), (error: unknown) => error instanceof GitError && error.code === "PATH_OUTSIDE_WORKSPACE");
});

test("gitStatus fails closed outside a git repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-nogit-"));
  await assert.rejects(() => gitStatus(root), (error: unknown) => error instanceof GitError && error.code === "NOT_A_GIT_REPOSITORY");
  await rm(root, { recursive: true, force: true });
});

test("parseUnifiedDiff splits lines into typed groups with running line numbers", () => {
  const diffText = [
    "diff --git a/a.ts b/a.ts",
    "index 1111111..2222222 100644",
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -1,2 +1,3 @@",
    " one",
    "-two",
    "+two-plus",
    "+three",
    "\\ No newline at end of file",
  ].join("\n");
  const parsed = parseUnifiedDiff(diffText);
  const kinds = parsed.lines.map((line) => line.kind);
  assert.deepEqual(kinds, ["header", "header", "header", "header", "hunk", "context", "remove", "add", "add", "header"]);
  assert.equal(parsed.insertions, 2);
  assert.equal(parsed.deletions, 1);
  const context = parsed.lines[5];
  assert.equal(context.oldLine, 1);
  assert.equal(context.newLine, 1);
  const remove = parsed.lines[6];
  assert.equal(remove.oldLine, 2);
  assert.equal(remove.newLine, undefined);
  const add = parsed.lines[7];
  assert.equal(add.newLine, 2);
  assert.equal(add.oldLine, undefined);
});

test("parseUnifiedDiff is empty-safe and bounded", () => {
  assert.deepEqual(parseUnifiedDiff(""), { lines: [], insertions: 0, deletions: 0 });
  assert.deepEqual(parseUnifiedDiff(undefined as unknown as string).insertions, 0);
});
