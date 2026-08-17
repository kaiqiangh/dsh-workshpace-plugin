import assert from "node:assert/strict";
import test from "node:test";

import { parseUnifiedDiff } from "../src/web/workspace-diff.ts";

test("computes intra-line tokens for adjacent remove/add runs", () => {
  const diff = [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,3 +1,3 @@",
    " const a = 1;",
    "-const count = 1;",
    "+const count = 2;",
    " const b = 3;",
  ].join("\n");
  const result = parseUnifiedDiff(diff);
  assert.equal(result.intraLine, true);
  assert.equal(result.insertions, 1);
  assert.equal(result.deletions, 1);

  const added = result.lines.find((line) => line.kind === "add");
  const removed = result.lines.find((line) => line.kind === "remove");
  assert.ok(added && added.tokens, "added line should carry tokens");
  assert.ok(removed && removed.tokens, "removed line should carry tokens");

  const addedKinds = added!.tokens!.map((token) => token.kind);
  const removedKinds = removed!.tokens!.map((token) => token.kind);
  assert.ok(addedKinds.includes("added"));
  assert.ok(addedKinds.includes("equal"));
  assert.ok(removedKinds.includes("removed"));
  assert.ok(removedKinds.includes("equal"));
  // The shared prefix is marked equal; only the trailing "1;"/"2;" differs.
  assert.equal(added!.tokens!.map((token) => token.text).join(""), "const count = 2;");
  assert.equal(removed!.tokens!.map((token) => token.text).join(""), "const count = 1;");
});

test("falls back to line-level coloring when a changed line exceeds the budget", () => {
  const longLine = "x".repeat(600);
  const diff = [
    "@@ -1,2 +1,2 @@",
    `-${longLine}`,
    `+${longLine}y`,
  ].join("\n");
  const result = parseUnifiedDiff(diff);
  assert.equal(result.intraLine, false, "the Operational Budget guard disables word-level highlighting");
  const added = result.lines.find((line) => line.kind === "add");
  assert.ok(added, "added line is still parsed");
  assert.equal(added!.tokens, undefined, "tokens are omitted when the guard trips");
});

test("honors operator-tunable budget options", () => {
  const diff = [
    "@@ -1,2 +1,2 @@",
    "-short",
    "+shorter",
  ].join("\n");
  // maxLineLength of 2 disables word-level for these 5/7-char lines.
  assert.equal(parseUnifiedDiff(diff, { maxLineLength: 2 }).intraLine, false);
  assert.equal(parseUnifiedDiff(diff, { maxLineLength: 64 }).intraLine, true);
});

test("reports header and hunk lines without tokens", () => {
  const diff = [
    "--- a/file.ts",
    "+++ b/file.ts",
    "@@ -1 +1 @@",
    " context",
    "-gone",
    "+here",
  ].join("\n");
  const result = parseUnifiedDiff(diff);
  const header = result.lines.find((line) => line.kind === "header");
  const hunk = result.lines.find((line) => line.kind === "hunk");
  assert.ok(header && header.tokens === undefined);
  assert.ok(hunk && hunk.tokens === undefined);
});
