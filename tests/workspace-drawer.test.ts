import test from "node:test";
import assert from "node:assert/strict";

import { createDrawerState, DrawerStateError, reduceDrawer, type PinnedContextSummary } from "../src/web/workspace-drawer.ts";
import { createLocalMetrics } from "../src/domain/metrics.ts";

test("opens the drawer and selects a tab", () => {
  const initial = createDrawerState();
  const opened = reduceDrawer(initial, { type: "open" }).state;
  const selected = reduceDrawer(opened, { type: "select-tab", tab: "Session" }).state;

  assert.equal(selected.open, true);
  assert.equal(selected.activeTab, "Session");
  assert.equal(selected.focusTrap, true);
  assert.equal(selected.focusVisible, true);
});

test("records drawer interactions through the local metric seam", () => {
  const metrics = createLocalMetrics({ sessionId: "session-1", rootId: `root:${"a".repeat(64)}` });
  let state = reduceDrawer(createDrawerState(), { type: "open" }, metrics).state;
  state = reduceDrawer(state, { type: "select-file", path: "src/auth.py" }, metrics).state;
  state = reduceDrawer(state, { type: "select-artifact", path: "output/report.md" }, metrics).state;
  state = reduceDrawer(state, { type: "set-preview", panel: { status: "unsupported" } }, metrics).state;
  const result = reduceDrawer(state, { type: "send-working-set" }, metrics);

  assert.equal(result.effect, "send-working-set");
  assert.deepEqual(metrics.snapshot().counts, {
    "workspace-opened": 1,
    "preview-opened": 1,
    "artifact-opened": 1,
    "working-set-sent": 1,
    "capability-degraded": 1,
  });
});

test("keeps selections while closing and returns focus to the opener", () => {
  let state = reduceDrawer(createDrawerState(), { type: "open" }).state;
  state = reduceDrawer(state, { type: "select-file", path: "src\\auth.py" }).state;
  state = reduceDrawer(state, { type: "select-activity", id: "activity-1" }).state;
  state = reduceDrawer(state, { type: "escape" }).state;

  assert.equal(state.open, false);
  assert.equal(state.focusReturn, "workspace-opener");
  assert.equal(state.focusTrap, false);
  assert.equal(state.selectedPath, "src/auth.py");
  assert.equal(state.selectedActivityId, "activity-1");
  assert.deepEqual(state.preview, { target: { type: "activity", id: "activity-1" }, status: "loading" });

  const directClose = reduceDrawer({ ...state, open: true, focusTrap: true }, { type: "close" }).state;
  assert.equal(directClose.open, false);
  assert.equal(directClose.focusReturn, "workspace-opener");
});

test("represents Working Set, panel state, and one send effect", () => {
  let state = createDrawerState();
  state = reduceDrawer(state, { type: "set-working-set", summary: { count: 3, unresolvedCount: 1 } }).state;
  state = reduceDrawer(state, { type: "set-panel", tab: "Files", panel: { status: "error", message: "File disappeared" } }).state;
  const result = reduceDrawer(state, { type: "send-working-set" });

  assert.deepEqual(result.state.workingSet, { count: 3, unresolvedCount: 1 });
  assert.deepEqual(result.state.panels.Files, { status: "error", message: "File disappeared" });
  assert.equal(result.effect, "send-working-set");

  assert.deepEqual(
    reduceDrawer(state, { type: "pin-working-set", path: "src\\auth.py" }).effect,
    { type: "pin-working-set", path: "src/auth.py" },
  );
  assert.deepEqual(
    reduceDrawer(state, { type: "unpin-working-set", path: "src/auth.py" }).effect,
    { type: "unpin-working-set", path: "src/auth.py" },
  );
  assert.equal(reduceDrawer(state, { type: "clear-working-set" }).effect, "clear-working-set");
});

test("opens a preview for each selectable evidence kind", () => {
  let state = createDrawerState();
  state = reduceDrawer(state, { type: "select-file", path: "src/auth.py" }).state;
  assert.deepEqual(state.preview, { target: { type: "file", path: "src/auth.py" }, status: "loading" });
  state = reduceDrawer(state, { type: "select-change", path: "src/auth.py" }).state;
  assert.deepEqual(state.preview, { target: { type: "change", path: "src/auth.py" }, status: "loading" });
  state = reduceDrawer(state, { type: "set-preview", panel: { status: "error", message: "Preview failed" } }).state;
  assert.deepEqual(state.preview, { target: { type: "change", path: "src/auth.py" }, status: "error", message: "Preview failed" });
  state = reduceDrawer(state, { type: "set-preview", panel: { status: "ready" } }).state;
  assert.deepEqual(state.preview, { target: { type: "change", path: "src/auth.py" }, status: "ready" });
  state = reduceDrawer(state, { type: "set-panel", tab: "Changes", panel: { status: "loading" } }).state;
  state = reduceDrawer(state, { type: "set-panel", tab: "Changes", panel: { status: "empty" } }).state;
  state = reduceDrawer(state, { type: "set-panel", tab: "Changes", panel: { status: "unsupported" } }).state;
  assert.equal(state.panels.Changes.status, "unsupported");
});

test("rejects invalid drawer inputs at the public seam", () => {
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "select-tab", tab: "Preview" } as never),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_TAB",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "set-working-set", summary: { count: 1, unresolvedCount: 2 } }),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_WORKING_SET",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "set-working-set", summary: null } as never),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_WORKING_SET",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "set-panel", tab: "Files", panel: { status: "error" } }),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_PANEL",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "set-panel", tab: "Files", panel: { status: "bogus" } as never }),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_PANEL",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "set-panel", tab: "Files", panel: null } as never),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_PANEL",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "set-panel", tab: "Files", panel: { status: "ready", message: 1 } } as never),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_PANEL",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "select-file", path: "" }),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_SELECTION",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "select-file", path: "." }),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_SELECTION",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), { type: "unknown" } as never),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_ACTION",
  );
  assert.throws(
    () => reduceDrawer(createDrawerState(), null as never),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_ACTION",
  );
});

test("keeps Pinned Context metadata browser-safe and exposes explicit keyboard effects", () => {
  const summary: PinnedContextSummary = {
    count: 1,
    capacity: "available",
    capacityTokens: 500,
    admittedTokens: 20,
    availableBudgetTokens: 400,
    remainingTokens: 380,
    entries: [{
      path: "src/auth.ts",
      order: 0,
      sourceStatus: "ready",
      status: "ready",
      contentHash: `sha256:${"a".repeat(64)}`,
      bytes: 40,
      estimatedTokens: 20,
      loadedAt: 100,
    }],
  };
  let state = reduceDrawer(createDrawerState(), { type: "set-pinned-context", summary }).state;
  assert.deepEqual(state.pinnedContext, summary);
  assert.deepEqual(reduceDrawer(state, { type: "pin-context", path: "src\\token.ts" }).effect, { type: "pin-context", path: "src/token.ts" });
  assert.deepEqual(reduceDrawer(state, { type: "unpin-context", path: "src/auth.ts" }).effect, { type: "unpin-context", path: "src/auth.ts" });
  assert.equal(reduceDrawer(state, { type: "clear-context" }).effect, "clear-context");
  assert.equal(reduceDrawer(state, { type: "inspect-pinned-context" }).effect, "inspect-pinned-context");
  const withContent = reduceDrawer(state, { type: "set-pinned-context", summary: { ...summary, entries: [{ ...summary.entries[0], content: "secret" }] } as never }).state;
  assert.equal("content" in withContent.pinnedContext.entries[0], false);
  assert.throws(() => reduceDrawer(state, { type: "set-pinned-context", summary: { ...summary, entries: [{ ...summary.entries[0], path: "/Users/kai/secret" }] } }), (error) => error instanceof DrawerStateError && error.code === "INVALID_PINNED_CONTEXT");
});
