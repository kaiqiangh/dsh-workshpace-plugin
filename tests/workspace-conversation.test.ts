import test from "node:test";
import assert from "node:assert/strict";

import {
  applyWorkspaceConversationContribution,
  createWorkspaceChatNodeComponent,
  workspaceConversationDefinition,
  workspaceConversationView,
  WorkspaceWebIntegrationError,
  type WorkspaceChatData,
  type WorkspaceConversationContributionContext,
} from "../src/web/workspace-conversation.ts";

const summary: WorkspaceChatData = { filesTouched: 8, changes: 3, artifacts: 2, workspaceName: "repo" };
const event = { type: "workspace/summary" as const, seq: 4, data: { id: "session-1", phase: "start" as const, summary } };

test("replays a supplied Workspace summary without scanning history", () => {
  const match = workspaceConversationDefinition.match(event);
  assert.deepEqual(match, { id: "session-1", role: "start" });
  const state = workspaceConversationDefinition.start({ key: "k", kind: "dsh-workspace-summary", id: "session-1", start: undefined, state: undefined }, {
    event,
    role: "start",
    id: "session-1",
    summary,
  });
  assert.deepEqual(state, summary);
  assert.deepEqual(workspaceConversationDefinition.buildViewNode({ key: "k", kind: "dsh-workspace-summary", id: "session-1", start: { event, role: "start", id: "session-1", summary }, state }), {
    key: "k",
    kind: "dsh-workspace-summary",
    id: "session-1",
    target: "chat",
    data: summary,
    anchorSeq: 4,
    location: { kind: "session" },
    visibility: "visible",
  });
  assert.equal(workspaceConversationDefinition.match({ ...event, data: { ...event.data, summary: { ...summary, changes: -1 } } }), null);
});

test("keeps the public conversation view snapshot ordered and incremental", () => {
  const builder = workspaceConversationView.create();
  const first = workspaceConversationDefinition.buildViewNode({ key: "a", kind: "dsh-workspace-summary", id: "a", start: { event, role: "start", id: "a", summary }, state: summary })!;
  const second = { ...first, key: "b", id: "b", data: { ...summary, changes: 4 } };
  const timeline = { turnOrder: [], turns: new Map() };
  const empty = builder.empty;
  builder.replace({ nodes: [first], timeline });
  const snapshot = builder.apply({ upserts: [second, { ...first, data: { ...summary, artifacts: 3 } }], timeline });
  assert.deepEqual(empty.order, []);
  assert.deepEqual(snapshot.order, ["a", "b"]);
  assert.equal(snapshot.nodes.get("a")?.data.artifacts, 3);
  assert.equal(snapshot.nodes.get("b")?.data.changes, 4);
});

test("binds the summary renderer, public registrations, and owned disposal", () => {
  const registrations: string[] = [];
  let cleanup: (() => void) | undefined;
  const context: WorkspaceConversationContributionContext = {
    conversationEvents: { register: () => { registrations.push("event"); return () => registrations.push("event-dispose"); } },
    conversationViews: { register: () => { registrations.push("view"); return () => registrations.push("view-dispose"); } },
    slots: {
      inject: (_key, callback) => { registrations.push("inject"); const dispose = callback(); return () => { dispose(); registrations.push("inject-dispose"); }; },
      register: () => { registrations.push("slot"); return () => registrations.push("slot-dispose"); },
    },
    effect: (factory) => { cleanup = factory() as (() => void); },
  };
  applyWorkspaceConversationContribution(context, {
    renderSummary: (model) => model,
    openWorkspace: () => undefined,
  });
  assert.deepEqual(registrations, ["event", "view", "inject", "slot"]);
  const component = createWorkspaceChatNodeComponent((model) => model, () => undefined);
  const card = component({ node: workspaceConversationDefinition.buildViewNode({ key: "k", kind: "dsh-workspace-summary", id: "session-1", start: { event, role: "start", id: "session-1", summary }, state: summary })! }) as { summary: WorkspaceChatData; openWorkspace: { label: string } };
  assert.deepEqual(card.summary, summary);
  assert.equal(card.openWorkspace.label, "Open Workspace");
  cleanup?.();
  assert.deepEqual(registrations.slice(-4), ["slot-dispose", "inject-dispose", "view-dispose", "event-dispose"]);
});

test("rejects missing public seams with a typed integration error", () => {
  assert.throws(() => applyWorkspaceConversationContribution(null as never, { renderSummary: () => undefined, openWorkspace: () => undefined }), (error) => error instanceof WorkspaceWebIntegrationError && error.code === "INTEGRATION_UNAVAILABLE");
});
