import assert from "node:assert/strict";
import test from "node:test";

import { buildDiffRows, hunkAnchor, parseUnifiedDiff } from "../src/web/workspace-diff.ts";
import { twoHunkDiffText } from "./fixtures.ts";

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

// ============ v0.5: inter-hunk context collapsing ============

test("collapses the context run between two hunks with a stable anchor", () => {
  const parsed = parseUnifiedDiff(twoHunkDiffText());
  const rows = buildDiffRows(parsed.lines, new Map());
  const expanders = rows.filter((row) => row.kind === "expander");
  assert.equal(expanders.length, 1, "exactly one collapsible gap between the two hunks");
  const expander = expanders[0];
  assert.ok(expander && expander.kind === "expander");
  // The gap keeps 3 context lines on EACH side; the hidden middle is just the
  // second hunk header (1 line).
  assert.equal(expander.hidden, 1);
  assert.equal(expander.revealed, 0);
  assert.equal(expander.total, 1);
  assert.equal(typeof expander.anchor, "string");
  assert.ok(expander.anchor.length > 0);
  // Both context sides stay visible: trailing 3, expander, leading 3, then the
  // next change block.
  const kinds = rows.map((row) => row.kind);
  const changeIndex = kinds.indexOf("add");
  assert.deepEqual(kinds.slice(changeIndex + 1, changeIndex + 4), ["context", "context", "context"]);
  assert.equal(kinds[changeIndex + 4], "expander");
  assert.deepEqual(kinds.slice(changeIndex + 5, changeIndex + 8), ["context", "context", "context"]);
  assert.equal(kinds[changeIndex + 8], "remove");
});

test("hunkAnchor is stable for identical headers and distinct otherwise", () => {
  const a = "@@ -10,6 +10,6 @@ export function f() {";
  assert.equal(hunkAnchor(a), hunkAnchor(a));
  assert.notEqual(hunkAnchor(a), hunkAnchor("@@ -11,6 +11,6 @@ export function f() {"));
  assert.notEqual(hunkAnchor("@@ -10,6 +10,6 @@ export function f() {"), hunkAnchor("@@ -10,6 +10,6 @@ export function g() {"));
});

test("expanding reveals the hidden middle and clamps at the gap boundary", () => {
  const parsed = parseUnifiedDiff(twoHunkDiffText());
  const anchor = buildDiffRows(parsed.lines, new Map()).find((row) => row.kind === "expander")?.anchor;
  assert.ok(anchor, "default build exposes the anchor");
  // Reveal 23 middle units into a 1-unit middle: fully shown, no expander.
  const rows = buildDiffRows(parsed.lines, new Map([[anchor!, 23]]));
  assert.equal(rows.filter((row) => row.kind === "expander").length, 0, "fully revealed gap leaves no expander");
  const contextCount = rows.filter((row) => row.kind === "context").length;
  assert.equal(contextCount, 12, "all twelve context lines are visible");
  assert.equal(rows.filter((row) => row.kind === "hunk").length, 2, "the hidden hunk header is back");
});

test("partial reveal shows part of the hidden middle then an expander for the rest", () => {
  const parsed = parseUnifiedDiff(twoHunkDiffText());
  // A zero-context budget makes the middle (hunk header + all leading context)
  // 4 units long, so partial reveals are observable.
  const anchor = buildDiffRows(parsed.lines, new Map(), { contextLines: 0 }).find((row) => row.kind === "expander")?.anchor;
  assert.ok(anchor);
  const rows = buildDiffRows(parsed.lines, new Map([[anchor!, 2]]), { contextLines: 0 });
  const expander = rows.find((row) => row.kind === "expander");
  assert.ok(expander && expander.kind === "expander");
  assert.equal(expander.revealed, 2);
  assert.equal(expander.hidden, 2); // 4-unit middle with 2 revealed
  assert.ok(rows.some((row) => row.kind === "hunk"), "revealing 2 exposes the hunk header");
});

test("does not collapse context before the first hunk or after the last hunk", () => {
  const diff = [
    "diff --git a/file.ts b/file.ts",
    " p1",
    " p2",
    " p3",
    "@@ -1,3 +1,3 @@",
    "-old",
    "+new",
    " q1",
    " q2",
    " q3",
  ].join("\n");
  const parsed = parseUnifiedDiff(diff);
  const rows = buildDiffRows(parsed.lines, new Map());
  assert.equal(rows.filter((row) => row.kind === "expander").length, 0);
  // Leading context before the hunk and trailing context after it stay.
  assert.equal(rows.filter((row) => row.kind === "context").length, 6);
});

test("honors operator-tunable context budget", () => {
  const parsed = parseUnifiedDiff(twoHunkDiffText());
  const rows = buildDiffRows(parsed.lines, new Map(), { contextLines: 1 });
  const expander = rows.find((row) => row.kind === "expander");
  assert.ok(expander && expander.kind === "expander");
  // 1 kept each side; middle = hunk header + 2 leading lines (3 hidden).
  assert.equal(expander.revealed, 0);
  assert.equal(expander.hidden, 3);
});

test("a short context run shorter than the budget is not collapsed", () => {
  const diff = [
    "@@ -1,2 +1,2 @@",
    "-old",
    "+new",
    " tail-1",
    " tail-2",
    "@@ -10,2 +10,2 @@",
    " lead-1",
    " lead-2",
    "-old2",
    "+new2",
  ].join("\n");
  const parsed = parseUnifiedDiff(diff);
  // Gap = tail-1, tail-2, @@ header, lead-1, lead-2 (5 lines); 2 kept each
  // side, so only the hunk header is hidden behind the expander.
  const rows = buildDiffRows(parsed.lines, new Map());
  const expander = rows.find((row) => row.kind === "expander");
  assert.ok(expander && expander.kind === "expander");
  assert.equal(expander.hidden, 1);
});

test("does not collapse an adjacent hunk with no gap content", () => {
  const diff = [
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
    "@@ -10,1 +10,1 @@",
    "-old2",
    "+new2",
  ].join("\n");
  const parsed = parseUnifiedDiff(diff);
  const rows = buildDiffRows(parsed.lines, new Map());
  // The hunk header alone (1 line) is not longer than the 3-line budget.
  assert.equal(rows.filter((row) => row.kind === "expander").length, 0);
});
