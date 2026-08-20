/**
 * Shared test fixtures for the Workspace web surfaces. Kept out of individual
 * test files so the two seams (parser and surface) exercise the same diff text.
 */

import type { SessionEventLike } from "../src/host/workspace-artifacts.ts";

/**
 * A minimal but realistic Harness `tool/call` + `tool/result` pair for a file
 * write, shaped exactly the way `@deepseek-ai/dsh-session` records it
 * (`data.message.source.callId`, `data.meta.diffs` with `oldText: null`). This
 * is the exact record the Workspace Artifacts carrier folds into a deliverable.
 */
export function writeFileToolEvents(path: string, content: string, callId = "call-fixture"): readonly SessionEventLike[] {
  return [
    { seq: 0, type: "tool/call", data: { callId, name: "write_file", arguments: JSON.stringify({ path }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: { source: { kind: "tool", callId }, content: [{ type: "tool-result", toolCallId: callId }] },
        meta: { diffs: [{ path, oldText: null, newText: content }] },
      },
    },
  ] as const;
}

/** A two-hunk diff whose inter-hunk gap is the standard 3+1+3 shape. */
export function twoHunkDiffText(): string {
  return [
    "diff --git a/file.ts b/file.ts",
    "@@ -1,6 +1,6 @@",
    " const a = 1;",
    " const b = 2;",
    " const c = 3;",
    "-const count = 1;",
    "+const count = 2;",
    " const tail = 1;",
    " const tail = 2;",
    " const tail = 3;",
    "@@ -10,6 +10,6 @@",
    " const lead = 1;",
    " const lead = 2;",
    " const lead = 3;",
    "-const old = 1;",
    "+const fresh = 2;",
    " const end = 1;",
    " const end = 2;",
    " const end = 3;",
  ].join("\n");
}
