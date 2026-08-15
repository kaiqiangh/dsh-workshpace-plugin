import test from "node:test";
import assert from "node:assert/strict";

import { createDrawerState, DrawerStateError, reduceDrawer } from "../src/web/workspace-drawer.ts";

test("opens the drawer and selects a tab", () => {
  const initial = createDrawerState();
  const opened = reduceDrawer(initial, { type: "open" }).state;
  const selected = reduceDrawer(opened, { type: "select-tab", tab: "Session" }).state;

  assert.equal(selected.open, true);
  assert.equal(selected.activeTab, "Session");
});

test("keeps selections while closing and returns focus to the opener", () => {
  let state = reduceDrawer(createDrawerState(), { type: "open" }).state;
  state = reduceDrawer(state, { type: "select-file", path: "src\\auth.py" }).state;
  state = reduceDrawer(state, { type: "select-activity", id: "activity-1" }).state;
  state = reduceDrawer(state, { type: "escape" }).state;

  assert.equal(state.open, false);
  assert.equal(state.focusReturn, "workspace-opener");
  assert.equal(state.selectedPath, "src/auth.py");
  assert.equal(state.selectedActivityId, "activity-1");
});

test("represents Working Set, panel state, and one send effect", () => {
  let state = createDrawerState();
  state = reduceDrawer(state, { type: "set-working-set", summary: { count: 3, unresolvedCount: 1 } }).state;
  state = reduceDrawer(state, { type: "set-panel", tab: "Files", panel: { status: "error", message: "File disappeared" } }).state;
  const result = reduceDrawer(state, { type: "send-working-set" });

  assert.deepEqual(result.state.workingSet, { count: 3, unresolvedCount: 1 });
  assert.deepEqual(result.state.panels.Files, { status: "error", message: "File disappeared" });
  assert.equal(result.effect, "send-working-set");
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
    () => reduceDrawer(createDrawerState(), { type: "set-panel", tab: "Files", panel: { status: "error" } }),
    (error) => error instanceof DrawerStateError && error.code === "INVALID_PANEL",
  );
});
