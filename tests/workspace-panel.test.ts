import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspacePanelComponent } from "../src/web/workspace-panel.ts";

test("renders one collapsed Workspace panel with artifact and memory tabs", () => {
  const render = createWorkspacePanelComponent({
    artifacts: () => ({ type: "artifacts" }),
    memory: () => ({ type: "memory" }),
  });
  const root = render({}) as { readonly type: string; readonly props: Record<string, any> };
  const children = root.props.children as readonly { readonly type: string; readonly props: Record<string, any> }[];

  assert.equal(root.type, "details");
  assert.equal(root.props["data-dsh-workspace"], "panel");
  assert.equal(children[0].type, "summary");
  assert.equal(children[1].props["data-dsh-workspace"], "drawer");
  assert.equal(children[1].props.children[0].props.id, "dsh-workspace-tab-artifacts");
  assert.equal(children[1].props.children[1].props.id, "dsh-workspace-tab-memory");
});
