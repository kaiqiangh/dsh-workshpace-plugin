import test from "node:test";
import assert from "node:assert/strict";

import {
  applyWorkspaceConversationContribution,
  createWorkspaceChatNodeComponent,
  createWorkspaceDrawerController,
  normalizeWorkspaceOperationPath,
  workspaceKeyboardControls,
  workspaceConversationDefinition,
  workspaceConversationView,
  workspaceSurfaceLayout,
  WorkspaceWebIntegrationError,
  type WorkspaceChatData,
  type WorkspaceConversationContributionContext,
  type WorkspaceHostClient,
} from "../src/web/workspace-conversation.ts";
import { createDrawerState } from "../src/web/workspace-drawer.ts";

const pinnedContextSummary = {
  count: 0,
  capacity: "available" as const,
  capacityTokens: 500,
  admittedTokens: 0,
  availableBudgetTokens: 400,
  remainingTokens: 400,
  entries: [],
};
const pinnedContextOne = {
  ...pinnedContextSummary,
  count: 1,
  entries: [{
    path: "src/auth.ts",
    order: 0,
    sourceStatus: "ready" as const,
    status: "ready" as const,
    contentHash: `sha256:${"a".repeat(64)}`,
    bytes: 4,
    estimatedTokens: 9,
    loadedAt: 1,
  }],
};

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

test("maps drawer actions to typed operations and keeps failures local", async () => {
  const calls: string[] = [];
  const client = {
    preview: async (path: string) => ({ type: "text", path, renderer: "ui-primitives", content: "ok", truncated: false }),
    diff: async (path?: string) => `diff:${path}`,
    pinWorkingSet: async (path: string) => { calls.push(`pin:${path}`); },
    unpinWorkingSet: async (path: string) => { calls.push(`unpin:${path}`); },
    clearWorkingSet: async () => { calls.push("clear"); },
    sendWorkingSet: async () => { calls.push("send"); throw new Error("offline"); },
  } as unknown as WorkspaceHostClient;
  const controller = createWorkspaceDrawerController(client, createDrawerState());
  await controller.dispatch({ type: "pin-working-set", path: "src\\auth.py" });
  const preview = await controller.dispatch({ type: "select-file", path: "src\\auth.py" });
  assert.equal(preview.data?.type, "text");
  const result = await controller.dispatch({ type: "send-working-set" });
  assert.deepEqual(calls, ["pin:src/auth.py", "send"]);
  assert.equal(result.error?.code, "LOCAL_OPERATION_FAILED");
  assert.equal(controller.getState().workingSet.count, 0);
});

test("models responsive layout and rejects invalid public paths/seams", () => {
  assert.deepEqual(workspaceSurfaceLayout(1200), { mode: "desktop", chatVisible: true, drawer: "right-side" });
  assert.deepEqual(workspaceSurfaceLayout(760), { mode: "narrow", chatVisible: false, drawer: "full-width" });
  assert.equal(normalizeWorkspaceOperationPath("src\\auth.py"), "src/auth.py");
  assert.throws(() => normalizeWorkspaceOperationPath("../secret"), WorkspaceWebIntegrationError);
  assert.throws(() => workspaceSurfaceLayout(Number.NaN), WorkspaceWebIntegrationError);
  assert.throws(() => applyWorkspaceConversationContribution(null as never, { renderSummary: () => undefined, openWorkspace: () => undefined }), (error) => error instanceof WorkspaceWebIntegrationError && error.code === "INTEGRATION_UNAVAILABLE");
});

test("keeps the drawer keyboard contract explicit at the Web seam", async () => {
  const client = {
    sendWorkingSet: async () => undefined,
  } as unknown as WorkspaceHostClient;
  const controller = createWorkspaceDrawerController(client);
  await controller.dispatch({ type: "open" });
  const closed = await controller.handleKey("Escape");
  assert.equal(closed.state.open, false);
  assert.equal(closed.state.focusReturn, "workspace-opener");
  assert.equal(closed.state.focusTrap, false);
  assert.equal(closed.state.focusVisible, true);
  assert.deepEqual(workspaceKeyboardControls.slice(0, 5), ["open-workspace", "close-workspace", "Files", "Session", "Changes"]);
});

test("loads and mutates Pinned Context through typed metadata-only Host operations", async () => {
  const calls: string[] = [];
  const client = {
    pinnedContext: async () => { calls.push("inspect"); return pinnedContextSummary; },
    pinContext: async (path: string) => { calls.push(`pin:${path}`); return pinnedContextOne; },
    unpinContext: async (path: string) => { calls.push(`unpin:${path}`); return pinnedContextSummary; },
    clearContext: async () => { calls.push("clear"); return pinnedContextSummary; },
  } as unknown as WorkspaceHostClient;
  const controller = createWorkspaceDrawerController(client, createDrawerState());
  const inspected = await controller.dispatch({ type: "inspect-pinned-context" });
  assert.deepEqual(inspected.data, pinnedContextSummary);
  const pinned = await controller.dispatch({ type: "pin-context", path: "src\\auth.ts" });
  assert.equal(pinned.state.pinnedContext.count, 1);
  const unpinned = await controller.dispatch({ type: "unpin-context", path: "src/auth.ts" });
  assert.equal(unpinned.state.pinnedContext.count, 0);
  await controller.dispatch({ type: "clear-context" });
  assert.deepEqual(calls, ["inspect", "pin:src/auth.ts", "unpin:src/auth.ts", "clear"]);
  assert.equal("content" in (controller.getState().pinnedContext.entries[0] ?? {}), false);
});

test("keeps Pinned Context inspection failures local to the Context panel", async () => {
  const client = { pinnedContext: async () => { throw new Error("offline"); } } as unknown as WorkspaceHostClient;
  const controller = createWorkspaceDrawerController(client, createDrawerState());
  const result = await controller.dispatch({ type: "inspect-pinned-context" });
  assert.equal(result.error?.operation, "inspect-pinned-context");
  assert.deepEqual(result.state.panels.Context, { status: "error", message: "Pinned Context is unavailable" });
});
