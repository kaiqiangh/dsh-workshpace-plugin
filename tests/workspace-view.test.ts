import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkspaceConversationViewComponent,
  workspaceConversationViewRegistration,
  WORKSPACE_VIEW_ENTRY_KEY,
  WORKSPACE_VIEW_LABEL,
  WORKSPACE_VIEW_ORDER,
  WORKSPACE_VIEW_SLOT,
} from "../src/web/workspace-view.ts";

test("conversation view registration descriptor is pinned", () => {
  assert.deepEqual(workspaceConversationViewRegistration(), {
    name: "conversation.view",
    id: "dsh-workspace",
    order: 20,
    label: "Workspace",
  });
  assert.equal(WORKSPACE_VIEW_SLOT, "conversation.view");
  assert.equal(WORKSPACE_VIEW_ENTRY_KEY, "dsh-workspace");
  assert.equal(WORKSPACE_VIEW_ORDER, 20);
  assert.equal(WORKSPACE_VIEW_LABEL, "Workspace");
});

test("renders one Workspace conversation view with artifact, memory, and changes tabs", () => {
  const render = createWorkspaceConversationViewComponent({
    artifacts: () => ({ type: "artifacts" }),
    memory: () => ({ type: "memory" }),
    changes: () => ({ type: "changes" }),
  });
  const root = render({}) as { readonly type: string; readonly props: Record<string, any> };
  const children = root.props.children as readonly { readonly type: string; readonly props: Record<string, any> }[];

  assert.equal(root.type, "section");
  assert.equal(root.props["data-dsh-workspace"], "view");
  assert.equal(children[0].props.id, "dsh-workspace-view-tab-artifacts");
  assert.equal(children[0].props.defaultChecked, true);
  assert.equal(children[1].props.id, "dsh-workspace-view-tab-memory");
  assert.equal(children[2].props.id, "dsh-workspace-view-tab-changes");
  assert.equal(children[3].props["data-dsh-workspace"], "panel-tabs");

  const content = children[4].props.children as readonly { readonly props: Record<string, any> }[];
  assert.equal(content[0].props["data-dsh-workspace-tab"], "artifacts");
  assert.equal(content[1].props["data-dsh-workspace-tab"], "memory");
  assert.equal(content[2].props["data-dsh-workspace-tab"], "changes");
});

test("passes props through to all surfaces", () => {
  const render = createWorkspaceConversationViewComponent({
    artifacts: () => ({ type: "artifacts" }),
    memory: () => ({ type: "memory" }),
    changes: () => ({ type: "changes" }),
  });
  const root = render({ sessionId: "session-1" }) as { readonly props: Record<string, any> };
  const children = root.props.children as readonly { readonly props: Record<string, any> }[];
  const content = children[4].props.children as readonly { readonly props: Record<string, any> }[];

  assert.deepEqual(content[0].props.children.props, { sessionId: "session-1" });
  assert.deepEqual(content[1].props.children.props, { sessionId: "session-1" });
  assert.deepEqual(content[2].props.children.props, { sessionId: "session-1" });
});
