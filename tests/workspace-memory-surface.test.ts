import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { MemoryRecord } from "../src/types.ts";
import { createWorkspaceMemorySurfaceComponent, workspaceMemoryRecordSummary, workspaceMemoryRequest } from "../src/web/workspace-memory-surface.ts";
import { setWorkspaceLocale } from "../src/web/workspace-i18n.ts";

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

// ---------- Memory surface redesign (#128) ----------

function recordFixture(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    schemaVersion: 1,
    id: "memory:1",
    scope: "project",
    scopeKey: "root:one",
    type: "fact",
    title: "Fact one",
    content: "Content one",
    tags: [],
    provenance: { kind: "agent", sessionId: "session-1" },
    createdAt: 1,
    updatedAt: 2,
    useCount: 0,
    contentHash: `sha256:${"a".repeat(64)}`,
    status: "active",
    ...overrides,
  };
}

interface MemoryCallLog {
  open: { request: unknown }[];
  list: { request: unknown; options?: unknown }[];
  search: { request: unknown; query: string; options?: unknown }[];
}

function remoteFixture(records: readonly MemoryRecord[] = []) {
  const calls: MemoryCallLog = { open: [], list: [], search: [] };
  const remote = {
    memoryOpen: async (request: unknown) => { calls.open.push({ request }); return { ok: true, value: { scope: "project", scopeKey: "root:one", records: [], warnings: [], readOnly: false } }; },
    memoryList: async (request: unknown, options?: unknown) => { calls.list.push({ request, options }); return { ok: true, value: records }; },
    memorySearch: async (request: unknown, query: string, options?: unknown) => { calls.search.push({ request, query, options }); return { ok: true, value: records }; },
    memoryUpsert: async () => ({ ok: true, value: {} }),
    memoryArchive: async () => ({ ok: true, value: {} }),
    memoryForget: async () => ({ ok: true, value: {} }),
    memoryGovern: async () => ({ ok: true, value: {} }),
    memoryExport: async () => ({ ok: true, value: "{}" }),
    memoryImport: async () => ({ ok: true, value: [] }),
  };
  return { remote, calls };
}

function buttonLabel(node: TestRenderer.ReactTestInstance): string {
  return node.children.join("");
}

test("switches scopes and reveals the user profile and shared-project acknowledgement", async () => {
  const { remote, calls } = remoteFixture([]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });

  const clickScope = async (label: string): Promise<void> => {
    const button = tree.root.findAllByType("button").find((node) => buttonLabel(node) === label);
    assert.ok(button, `a scope button labeled ${label} is rendered`);
    await act(async () => { button.props.onClick(); });
  };

  await clickScope("Session");
  assert.ok(calls.list.some((call) => (call.request as { scope?: string }).scope === "session"));
  assert.equal(tree.root.findAll((node) => node.props["aria-label"] === "User profile").length, 0);

  await clickScope("User");
  assert.ok(calls.list.some((call) => (call.request as { scope?: string }).scope === "user"));
  assert.equal(tree.root.findAll((node) => node.props["aria-label"] === "User profile").length, 1, "user scope renders the userId input");

  await clickScope("Shared Project");
  assert.ok(calls.list.some((call) => (call.request as { scope?: string }).scope === "shared-project"));
  assert.equal(tree.root.findAll((node) => node.props.type === "checkbox").length, 1, "shared-project scope renders the acknowledgement checkbox");
  const ackText = "I understand this writes to the shared Workspace Memory.";
  const ackLabel = tree.root.findAll((node) => Array.isArray(node.children) && node.children.some((child) => typeof child === "string" && child.includes(ackText)));
  assert.ok(ackLabel.length > 0, "the acknowledgement label is rendered");
});

test("debounces search intent before flushing a memorySearch", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { remote, calls } = remoteFixture([]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  assert.equal(calls.search.length, 0);

  const input = tree.root.find((node) => node.props["aria-label"] === "Search Memory");
  act(() => input.props.onChange({ target: { value: "alpha" } }));
  act(() => input.props.onChange({ target: { value: "alph" } }));
  assert.equal(calls.search.length, 0, "no search request before the debounce fires");
  await act(async () => {
    t.mock.timers.tick(220);
    await Promise.resolve();
  });
  assert.equal(calls.search.length, 1, "the trailing debounced intent is flushed");
  assert.equal(calls.search[0]?.query, "alph");
  t.mock.timers.reset();
});

test("type and status filters narrow the remote list", async () => {
  const { remote, calls } = remoteFixture([]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  assert.equal(calls.list.length, 1);

  const typeSelect = tree.root.find((node) => node.props["aria-label"] === "Type filter");
  await act(async () => { typeSelect.props.onChange({ target: { value: "fact" } }); });
  assert.ok(calls.list.some((call) => (call.options as { type?: string } | undefined)?.type === "fact"), "memoryList is called with the selected type filter");

  const statusSelect = tree.root.find((node) => node.props["aria-label"] === "Status filter");
  await act(async () => { statusSelect.props.onChange({ target: { value: "archived" } }); });
  assert.ok(calls.list.some((call) => (call.options as { status?: string } | undefined)?.status === "archived"), "memoryList is called with the selected status filter");
});

test("selecting a record shows its governance table and switches the detail", async () => {
  const first = recordFixture({ id: "memory:1", title: "First fact" });
  const second = recordFixture({ id: "memory:2", title: "Second fact", contentHash: `sha256:${"b".repeat(64)}` });
  const { remote } = remoteFixture([first, second]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });

  const governance = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "memory-governance");
  assert.equal(governance.length, 1, "a selected record shows its governance table");
  const terms = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "memory-tip").map((node) => buttonLabel(node));
  assert.deepEqual(terms, ["Origin", "Verification", "Retention", "Revision", "Sources"]);

  const select = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "memory-select").find((node) => buttonLabel(node) === "Second fact");
  assert.ok(select, "the second card is selectable");
  await act(async () => { select.props.onClick(); });
  const detailTitle = tree.root.find((node) => node.props["data-dsh-workspace"] === "memory-detail-header").findAllByType("h3");
  assert.equal(detailTitle[0]?.children.join(""), "Second fact");
});

test("long content renders inside a scrollable pre and long source ids truncate", async () => {
  const styles = readFileSync(new URL("../src/web/workspace-styles.ts", import.meta.url), "utf8");
  assert.match(styles, /\[data-dsh-workspace="memory-content"\]/, "the content pre selector exists");
  assert.match(styles, /max-height: 220px/, "the content pre has a bounded max-height");
  assert.match(styles, /\[data-dsh-workspace="memory-source"\]/, "the source truncation selector exists");
  assert.match(styles, /text-overflow: ellipsis/, "long source ids truncate with an ellipsis");

  const longContent = "l".repeat(2048);
  const longSourceId = `session:${"x".repeat(80)}`;
  const rec = recordFixture({
    content: longContent,
    governance: {
      origin: "derived" as const,
      sourceRefs: [{ kind: "session" as const, id: longSourceId }],
      verification: "unverified" as const,
      revision: 1,
      retention: "project-delete" as const,
    },
  });
  const { remote } = remoteFixture([rec]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });

  const pres = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "memory-content");
  assert.equal(pres.length, 1);
  const text = Array.isArray(pres[0]!.children) ? pres[0]!.children.join("") : String(pres[0]!.children ?? "");
  assert.equal(text, longContent, "the full content is rendered inside the pre");

  const sources = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "memory-source");
  assert.ok(sources.length > 0);
  assert.ok(sources.every((node) => typeof node.props.title === "string" && node.props.title.length > 30), "long source ids carry the full value in a tooltip");
});

test("locale swap re-renders the surface labels", async () => {
  setWorkspaceLocale("en");
  const rec = recordFixture();
  const { remote } = remoteFixture([rec]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  const heading = tree.root.find((node) => node.type === "h2");
  assert.equal(heading.children.join(""), "Memory");
  try {
    act(() => setWorkspaceLocale("zh"));
    assert.equal(tree.root.find((node) => node.type === "h2").children.join(""), "记忆", "the surface heading follows the locale");
    assert.ok(tree.root.findAllByType("button").some((node) => buttonLabel(node) === "项目"), "scope buttons relabel to Chinese");
  } finally {
    act(() => setWorkspaceLocale("en"));
  }
});

test("shared-project scope keeps writes disabled until acknowledged", async () => {
  const rec = recordFixture({ scope: "shared-project", scopeKey: "root:shared" });
  const { remote } = remoteFixture([rec]);
  const render = createWorkspaceMemorySurfaceComponent({ remote });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });

  const sharedButton = tree.root.findAllByType("button").find((node) => buttonLabel(node) === "Shared Project");
  assert.ok(sharedButton);
  await act(async () => { sharedButton.props.onClick(); });

  const ack = tree.root.find((node) => node.props.type === "checkbox");
  assert.equal(ack.props.checked, false);
  const edit = tree.root.findAllByType("button").find((node) => buttonLabel(node) === "Edit");
  assert.ok(edit, "the Edit action is rendered for the selected record");
  assert.equal(edit.props.disabled, true, "Edit is disabled without acknowledgement");

  await act(async () => { ack.props.onChange({ target: { checked: true } }); });
  const editAfter = tree.root.findAllByType("button").find((node) => buttonLabel(node) === "Edit");
  assert.equal(editAfter.props.disabled, false, "Edit is enabled after acknowledgement");
});
