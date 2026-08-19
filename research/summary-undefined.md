# Research: Workspace summary renders `undefined` counts (#119)

Child of map #117. Read-only investigation — **no fix landed in `src/` or `lib/`**.

## Root cause (one sentence)

The Web summary block renders `summary` fields **without a shape guard**, so a
partial payload (an object carrying only `workspaceName`, which surfaces as the
literal `"Workspace"` while the numeric keys are absent) paints
`undefined files · undefined added · undefined modified · undefined deleted ·
undefined artifacts` — the legacy `validSummary` validator that the old
`workspace/summary` event path used was **dropped** when the summary moved to the
on-demand Typert `workspaceSummary` remote.

- **Bug originates at:** `src/web/workspace-summary-block.ts:79-95` (renders
  `summary.workspaceName`, `summary.filesTouched`, `summary.filesCreated`,
  `summary.filesModified`, `summary.filesDeleted`, `summary.artifacts` directly,
  with **no `validSummaryShape` check**).

## Disambiguation of the four hypotheses

| Hypothesis | Verdict | Evidence |
|---|---|---|
| (a) Host returns a partial-shape object | **Rejected** | `workspaceSummaryFor` (`src/host/workspace-summary.ts:93-108`) always builds a *complete* `WorkspaceSummaryData` via `Object.freeze({ filesTouched: files.length, …, workspaceName: basename(root), … })`. The test `tests/workspace-summary.test.ts` asserts real numbers (`filesTouched === 2`, `artifacts === 1`), never `undefined`. |
| (b) Bridge serializer drops fields | **Rejected** | The `workspaceSummary` result codec in `lib/typert.host.js:604-617` and `lib/typert.remote-client.js:604-617` declares **all 11 fields required** (`z.union([z.undefined(), z.object({ filesTouched: z.number(), … })] — strict, no optional/omitted keys). Nothing is stripped on the wire. |
| (c) Web block renders unvalidated fields | **Confirmed (defect)** | `workspace-summary-block.ts:80` only guards `if (!summary) return null;`. It never checks that the numeric keys exist. Any truthy partial object bypasses the guard and dereferences `undefined` for every count. |
| (d) `basename(root)` → `"Workspace"` while counts `undefined` | **Partial / explains the name, not the counts** | `workspaceName: basename(root)` can legitimately equal `"Workspace"` when the resolved workspace root directory is named `Workspace`. But `workspaceSummaryFor` always fills the counts from `files.length` / `.filter().length`, so counts are real numbers, never `undefined`. The *undefined counts* must come from a payload that never passed through `workspaceSummaryFor` — i.e. a partial stub that lacks the numeric keys, which the unguarded block then renders raw. |

### Net conclusion
The host and the Typert bridge are **not** at fault. The block is missing the
`validSummaryShape` validation that existed in the legacy path
(`src/web/workspace-conversation.ts:131-145` `validSummary`, mirrored in the
old compiled `lib/client.js:26-30`). When the live remote delivers a partial
summary object (the observed failure carries only `workspaceName: "Workspace"`),
the block treats it as renderable and prints `undefined` for every numeric
metric.

## Recommended fix (minimal, single file)

File: `src/web/workspace-summary-block.ts`

1. Port the existing `validCount` / `validWorkspaceName` / `validSummaryShape`
   helpers (already defined in `src/web/workspace-conversation.ts:123-145`) into
   the block module (or import them).
2. Guard the payload **before** it reaches state / DOM.

Before (current, lines 62-80):

```ts
const value = await activeRemote.workspaceSummary();
if (!active || token !== request.current) return;
setSummary(value);
setMessage(undefined);
// …
if (!sessionId || !loaded) return null;
if (!summary) return null;
```

After (sketch):

```ts
const value = await activeRemote.workspaceSummary();
if (!active || token !== request.current) return;
// Drop partial/garbled payloads instead of painting `undefined` counts.
setSummary(value && validSummaryShape(value) ? value : undefined);
setMessage(undefined);

// … (guard unchanged)
if (!sessionId || !loaded) return null;
if (!summary) return null;
```

`validSummaryShape` (mirrors the legacy guard):

```ts
function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && value >= 0;
}
function validWorkspaceName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);
}
function validSummaryShape(value: unknown): value is WorkspaceSummaryData {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<WorkspaceSummaryData>;
  return validCount(s.filesTouched) && validCount(s.changes) && validCount(s.artifacts)
    && validCount(s.filesCreated) && validCount(s.filesModified) && validCount(s.filesDeleted)
    && validCount(s.firstObservedAt) && validCount(s.lastObservedAt)
    && validCount(s.memoryCount) && validCount(s.decisionCount)
    && validWorkspaceName(s.workspaceName);
}
```

This is the smallest patch: it suppresses the broken partial payload (the block
already renders `null` when `summary` is falsy), so `undefined` can never reach
the DOM. It does **not** change the host, the bridge, or any serializer.

## Minimal test that proves `undefined` no longer reaches the DOM

Add to a new `tests/workspace-summary-block.test.ts` (research-only sketch; not
committed into `src/`):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { validSummaryShape } from "../src/web/workspace-summary-block.ts";

test("partial payload with only workspaceName is rejected", () => {
  // The exact shape observed in #119: name present, counts absent.
  const partial = { workspaceName: "Workspace" };
  assert.equal(validSummaryShape(partial), false);
});

test("complete host payload passes validation", () => {
  const full = {
    filesTouched: 2, changes: 2, artifacts: 1, workspaceName: "repo",
    filesCreated: 1, filesModified: 1, filesDeleted: 0,
    firstObservedAt: 2, lastObservedAt: 4, memoryCount: 0, decisionCount: 0,
  };
  assert.equal(validSummaryShape(full), true);
});
```

Because `load()` now sets `summary` to `undefined` when `validSummaryShape`
fails, the component returns `null` and the strings `undefined files` /
`undefined added` / `undefined artifacts` can no longer appear in the rendered
output for a partial payload.

## Bridge serializer note (explicit)

The Typert bridge is **not** the culprit. Quoted result schema it serializes
(`lib/typert.remote-client.js:604-617`):

```js
const dsh_workspace_plugin_workspace_workspaceSummary_result$schema = z.union([z.undefined(), z.object({
  'filesTouched': z.number().readonly(),
  'changes': z.number().readonly(),
  'artifacts': z.number().readonly(),
  'workspaceName': z.string().readonly(),
  'filesCreated': z.number().readonly(),
  'filesModified': z.number().readonly(),
  'filesDeleted': z.number().readonly(),
  'firstObservedAt': z.number().readonly(),
  'lastObservedAt': z.number().readonly(),
  'memoryCount': z.number().readonly(),
  'decisionCount': z.number().readonly(),
})])
```

No field is dropped; a complete object on the wire stays complete on decode.
