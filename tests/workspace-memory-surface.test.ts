import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { createWorkspaceMemorySurfaceComponent, workspaceMemoryRecordSummary, workspaceMemoryRequest } from "../src/web/workspace-memory-surface.ts";

test("builds explicit scope requests without exposing filesystem paths", () => {
  assert.deepEqual(workspaceMemoryRequest("project", "ignored"), { scope: "project" });
  assert.deepEqual(workspaceMemoryRequest("user", " profile-1 "), { scope: "user", userId: "profile-1" });
  assert.deepEqual(workspaceMemoryRequest("shared-project", "ignored", true), { scope: "shared-project", sharedProject: true });
});

test("renders bounded provenance and hash metadata before review", () => {
  const summary = workspaceMemoryRecordSummary({
    schemaVersion: 1,
    id: "memory:1",
    scope: "project",
    scopeKey: "root:one",
    type: "decision",
    title: "Decision",
    content: "Local",
    tags: [],
    provenance: { kind: "agent", sessionId: "session-1" },
    createdAt: 1,
    updatedAt: 2,
    useCount: 0,
    contentHash: `sha256:${"a".repeat(64)}`,
    status: "active",
  });
  assert.equal(summary, "project · decision · agent/session-1 · sha256:aaaaaaaa · updated 2 · last-used never · used 0");
  assert.doesNotMatch(summary, /root:one/u);
});

test("renders a degraded notice instead of nothing without an active session", () => {
  const render = createWorkspaceMemorySurfaceComponent({});
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, {})); });
  const texts = tree.root.findAllByType("p").map((node) => node.children.join(""));
  assert.ok(texts.includes("Workspace Memory requires an active Harness session."));
});

test("keeps a single governance Pin control (no UI-only Pin for review)", async () => {
  const remote = {
    memoryOpen: async () => ({ ok: true, value: { scope: "project", scopeKey: "root:one", records: [], warnings: [], readOnly: false } }),
    memoryList: async () => ({ ok: true, value: [] }),
    memorySearch: async () => ({ ok: true, value: [] }),
    memoryUpsert: async () => ({ ok: true, value: {} }),
    memoryArchive: async () => ({ ok: true, value: {} }),
    memoryForget: async () => ({ ok: true, value: {} }),
    memoryGovern: async () => ({ ok: true, value: {} }),
    memoryExport: async () => ({ ok: true, value: "{}" }),
    memoryImport: async () => ({ ok: true, value: [] }),
  };
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  const buttons = tree.root.findAllByType("button").map((node) => node.children.join(""));
  assert.ok(buttons.includes("Create Memory"));
  assert.equal(buttons.includes("Pin for review"), false);
  assert.equal(buttons.includes("Pinned for review"), false);
});

test("renders model-suggested proposals with a Proposal badge", async () => {
  const record = {
    schemaVersion: 1 as const,
    id: "memory:proposal-1",
    scope: "project" as const,
    scopeKey: "root:one",
    type: "convention" as const,
    title: "Proposed convention",
    content: "Use conventional commits.",
    tags: [],
    provenance: { kind: "agent", sessionId: "session-1" },
    createdAt: 1,
    updatedAt: 2,
    useCount: 0,
    contentHash: `sha256:${"c".repeat(64)}`,
    status: "active" as const,
    governance: {
      origin: "model-suggested" as const,
      sourceRefs: [{ kind: "session", id: "session-1" }],
      verification: "unverified" as const,
      revision: 1,
      retention: "project-delete" as const,
    },
  };
  const remote = {
    memoryOpen: async () => ({ ok: true, value: { scope: "project", scopeKey: "root:one", records: [record], warnings: [], readOnly: false } }),
    memoryList: async () => ({ ok: true, value: [record] }),
    memorySearch: async () => ({ ok: true, value: [record] }),
    memoryUpsert: async () => ({ ok: true, value: record }),
    memoryArchive: async () => ({ ok: true, value: record }),
    memoryForget: async () => ({ ok: true, value: record }),
    memoryGovern: async () => ({ ok: true, value: record }),
    memoryExport: async () => ({ ok: true, value: "{}" }),
    memoryImport: async () => ({ ok: true, value: [] }),
  };
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  const badges = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "memory-badge").map((node) => node.children.join(""));
  assert.ok(badges.includes("Proposal"));
  assert.ok(badges.includes("unverified"));
});

test("renders a two-column list | detail layout", async () => {
  const record = {
    schemaVersion: 1 as const,
    id: "memory:1",
    scope: "project" as const,
    scopeKey: "root:one",
    type: "decision" as const,
    title: "Decision",
    content: "Local",
    tags: [],
    provenance: { kind: "agent", sessionId: "session-1" },
    createdAt: 1,
    updatedAt: 2,
    useCount: 0,
    contentHash: `sha256:${"a".repeat(64)}`,
    status: "active" as const,
  };
  const remote = {
    memoryOpen: async () => ({ ok: true, value: { scope: "project", scopeKey: "root:one", records: [record], warnings: [], readOnly: false } }),
    memoryList: async () => ({ ok: true, value: [record] }),
    memorySearch: async () => ({ ok: true, value: [record] }),
    memoryUpsert: async () => ({ ok: true, value: record }),
    memoryArchive: async () => ({ ok: true, value: record }),
    memoryForget: async () => ({ ok: true, value: record }),
    memoryGovern: async () => ({ ok: true, value: record }),
    memoryExport: async () => ({ ok: true, value: "{}" }),
    memoryImport: async () => ({ ok: true, value: [] }),
  };
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "columns").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "column-list").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "column-detail").length, 1);
});
