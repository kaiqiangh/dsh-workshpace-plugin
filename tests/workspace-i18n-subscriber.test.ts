import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  setWorkspaceLocale,
  subscribeWorkspaceLocale,
  useWorkspaceLocale,
  workspaceLocale,
  t,
} from "../src/web/workspace-i18n.ts";
import { workspaceConversationViewRegistration } from "../src/web/workspace-view.ts";

test("setWorkspaceLocale notifies subscribers and skips no-op updates", () => {
  setWorkspaceLocale("en");
  let calls = 0;
  const dispose = subscribeWorkspaceLocale(() => { calls += 1; });
  setWorkspaceLocale("en"); // same value -> no notify
  assert.equal(calls, 0);
  setWorkspaceLocale("zh");
  assert.equal(calls, 1);
  setWorkspaceLocale("en");
  assert.equal(calls, 2);
  dispose();
  setWorkspaceLocale("zh");
  assert.equal(calls, 2, "disposed listener is not called again");
  setWorkspaceLocale("en");
});

test("t() follows the active locale for the same key", () => {
  setWorkspaceLocale("en");
  assert.equal(t("view.workspace"), "Workspace");
  setWorkspaceLocale("zh");
  try {
    assert.equal(t("view.workspace"), "工作区");
    assert.equal(t("artifacts.title"), "产物");
  } finally {
    setWorkspaceLocale("en");
  }
});

test("useWorkspaceLocale re-renders the consumer on locale change", () => {
  setWorkspaceLocale("en");
  function Probe(): ReactNode {
    const locale = useWorkspaceLocale();
    return createElement("span", null, locale);
  }
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(Probe)); });
  assert.equal(tree.toJSON()?.children?.[0], "en", "renders the current locale");
  act(() => { setWorkspaceLocale("zh"); });
  assert.equal(tree.toJSON()?.children?.[0], "zh", "re-renders after the locale changes");
  act(() => { setWorkspaceLocale("en"); });
  assert.equal(tree.toJSON()?.children?.[0], "en");
});

test("the Workspace tab label is localized through the registration", () => {
  setWorkspaceLocale("en");
  assert.equal(workspaceConversationViewRegistration().label(), "Workspace");
  setWorkspaceLocale("zh");
  try {
    assert.equal(workspaceConversationViewRegistration().label(), "工作区");
  } finally {
    setWorkspaceLocale("en");
  }
});

test("locale resets to English at the end of the suite", () => {
  assert.equal(workspaceLocale(), "en");
});
