import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  createWorkspaceConversationViewComponent,
  workspaceConversationViewRegistration,
  WORKSPACE_VIEW_ENTRY_KEY,
  WORKSPACE_VIEW_LABEL,
  WORKSPACE_VIEW_ORDER,
  WORKSPACE_VIEW_SLOT,
} from "../src/web/workspace-view.ts";

test("conversation view registration descriptor is pinned", () => {
  const registration = workspaceConversationViewRegistration();
  assert.equal(registration.name, "conversation.view");
  assert.equal(registration.id, "dsh-workspace");
  assert.equal(registration.order, 20);
  assert.equal(registration.locale, "dsh-workspace");
  assert.equal(registration.label(), "Workspace");
  // rc.7: inject(sessionId) returns the useSessions seat the surfaces read.
  assert.equal(registration.inject("session-1").useSessions(), "session-1");
  assert.equal(WORKSPACE_VIEW_SLOT, "conversation.view");
  assert.equal(WORKSPACE_VIEW_ENTRY_KEY, "dsh-workspace");
  assert.equal(WORKSPACE_VIEW_ORDER, 20);
  assert.equal(WORKSPACE_VIEW_LABEL, "Workspace");
});

function renderView(
  options: Parameters<typeof createWorkspaceConversationViewComponent>[0],
  props: Record<string, unknown> = {},
): TestRenderer.ReactTestRenderer {
  const render = createWorkspaceConversationViewComponent(options);
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, props)); });
  return tree;
}

test("renders one Workspace conversation view with artifact, memory, and git tabs", () => {
  const tree = renderView({
    artifacts: () => createElement("div", { "data-dsh-workspace-tab-surface": "artifacts" }),
    memory: () => createElement("div", { "data-dsh-workspace-tab-surface": "memory" }),
    git: () => createElement("div", { "data-dsh-workspace-tab-surface": "git" }),
  });
  const section = tree.root.find((node) => node.type === "section");
  assert.equal(section.props["data-dsh-workspace"], "view");
  // Tab inputs: artifacts is the default (checked) tab.
  const artifactsInput = tree.root.find((node) => node.props.id === "dsh-workspace-view-tab-artifacts");
  assert.equal(artifactsInput.props.defaultChecked, true);
  assert.equal(tree.root.findAll((node) => node.props.id === "dsh-workspace-view-tab-memory").length, 1);
  assert.equal(tree.root.findAll((node) => node.props.id === "dsh-workspace-view-tab-git").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "panel-tabs").length, 1);
  // Each surface is mounted in its own tab-content panel.
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace-tab"] === "artifacts").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace-tab"] === "memory").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace-tab"] === "git").length, 1);
});

test("renders the summary block above the tabs when provided", () => {
  const summary = () => createElement("div", { "data-dsh-workspace-tab-surface": "summary" });
  const tree = renderView({
    artifacts: () => createElement("div"),
    memory: () => createElement("div"),
    git: () => createElement("div"),
    summary,
  });
  const summaryBlock = tree.root.find((node) => node.props["data-dsh-workspace-tab-surface"] === "summary");
  assert.ok(summaryBlock, "summary block is rendered");
  // The summary element precedes the artifacts tab input in document order.
  const order = tree.root.findAll((node) => node.props.id === "dsh-workspace-view-tab-artifacts" || node.props["data-dsh-workspace-tab-surface"] === "summary");
  assert.equal(order[0]?.props["data-dsh-workspace-tab-surface"], "summary");
  assert.equal(order[1]?.props.id, "dsh-workspace-view-tab-artifacts");
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "panel-tabs").length, 1);
});

test("passes props through to all surfaces", () => {
  const surface = (label: string) => () => createElement("div", { "data-dsh-workspace-tab-surface": label, "data-prop": "session-1" });
  const tree = renderView({
    artifacts: surface("artifacts"),
    memory: surface("memory"),
    git: surface("git"),
  }, { sessionId: "session-1" });
  for (const label of ["artifacts", "memory", "git"]) {
    const nodes = tree.root.findAll((node) => node.props["data-dsh-workspace-tab-surface"] === label);
    assert.equal(nodes.length, 1, `${label} surface rendered once`);
    assert.equal(nodes[0]?.props["data-prop"], "session-1", `${label} surface receives the props`);
  }
});
