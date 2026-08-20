import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  createWorkspaceArtifactSurfaceComponent,
  formatRelativeTime,
  workspaceArtifactCategory,
  workspaceArtifactPreviewDescriptor,
  workspaceArtifactResourceUrl,
} from "../src/web/workspace-artifact-surface.ts";
import { setWorkspaceLocale } from "../src/web/workspace-i18n.ts";

const artifact = {
  id: "workspace:artifact",
  name: "report.md",
  mediaType: "text/markdown",
  sizeBytes: 12,
  source: { sessionId: "session-1", workspaceId: "root-1", kind: "artifact" as const },
  preview: "available" as const,
  resourceId: "resource-1",
  version: "12:1:1:1",
  downloadName: "report.md",
  mtimeMs: 1_700_000_000_000,
};

test("adapts path-free preview data with a display-only path", () => {
  const descriptor = workspaceArtifactPreviewDescriptor(artifact, {
    type: "markdown",
    renderer: "ui-primitives",
    content: "# Report",
    truncated: false,
    policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] },
  });
  assert.equal(descriptor.path, "report.md");
  assert.equal(JSON.stringify(descriptor).includes("/Users/"), false);
});

test("builds only the relative opaque resource URL", () => {
  assert.equal(workspaceArtifactResourceUrl(artifact), "/workspace/resource?id=resource-1&type=text%2Fmarkdown&download=1");
});

test("groups artifacts by media type", () => {
  assert.equal(workspaceArtifactCategory("text/markdown"), "documents");
  assert.equal(workspaceArtifactCategory("text/plain"), "documents");
  assert.equal(workspaceArtifactCategory("application/json"), "data");
  assert.equal(workspaceArtifactCategory("text/csv"), "data");
  assert.equal(workspaceArtifactCategory("image/png"), "images");
  assert.equal(workspaceArtifactCategory("application/zip"), "other");
});

test("renders a degraded notice instead of nothing without an active session", () => {
  const primitives = {
    MarkdownText: () => null,
    CodeBlock: () => null,
    JsonTree: () => null,
  };
  const render = createWorkspaceArtifactSurfaceComponent(undefined, primitives, {});
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(createElement(render, {})); });
  const texts = tree.root.findAllByType("p").map((node) => node.children.join(""));
  assert.ok(texts.includes("Workspace artifacts require an active Harness session."));
});

test("renders grouped artifact cards with a count badge", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [artifact] }),
    previewArtifact: async () => ({
      ok: true,
      value: {
        type: "markdown",
        renderer: "ui-primitives",
        content: "# Report",
        truncated: false,
        policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] },
      },
    }),
  };
  const primitives = {
    MarkdownText: () => null,
    CodeBlock: () => null,
    JsonTree: () => null,
  };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const countBadges = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "count-badge").map((node) => node.children.join(""));
  assert.ok(countBadges.includes("1 artifact"));
  const groups = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-group").map((node) => node.props["aria-label"]);
  assert.ok(groups.includes("Documents artifacts"));
  assert.ok(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-item").length >= 1);
});

test("renders an empty state when the session has no artifacts", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [] }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const primitives = {
    MarkdownText: () => null,
    CodeBlock: () => null,
    JsonTree: () => null,
  };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const texts = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "empty-state").map((node) => node.children.join(""));
  assert.ok(texts.some((text) => text.includes("No session artifacts yet")));
});

test("filters artifacts by name as the search query changes", async () => {
  const make = (id: string, name: string, mediaType: string) => ({
    id, name, mediaType, sizeBytes: 12,
    source: { sessionId: "session-1", workspaceId: "root-1", kind: "artifact" as const },
    preview: "available" as const, resourceId: `resource-${id}`, version: "1:1:1:1", downloadName: name,
  });
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [make("1", "report.md", "text/markdown"), make("2", "notes.txt", "text/plain")] }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-item").length, 2);
  const search = tree.root.find((node) => node.props["aria-label"] === "Search artifacts" && node.type === "input");
  await act(async () => { search.props.onChange({ target: { value: "report" } }); });
  const items = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-item");
  assert.equal(items.length, 1);
  const names = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-select").map((node) => node.children.join(""));
  assert.deepEqual(names, ["report.md"]);
});

test("renders a two-column list | detail layout", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [artifact] }),
    previewArtifact: async () => ({
      ok: true,
      value: {
        type: "markdown",
        renderer: "ui-primitives",
        content: "# Report",
        truncated: false,
        policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] },
      },
    }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "columns").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "column-list").length, 1);
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "column-detail").length, 1);
});

test("skips a malformed artifact and shows a hidden-count warning instead of failing", async () => {
  const valid = {
    id: "workspace:ok", name: "ok.md", mediaType: "text/markdown", sizeBytes: 12,
    source: { sessionId: "session-1", workspaceId: "root-1", kind: "artifact" as const },
    preview: "available" as const, resourceId: "resource-ok", version: "1:1:1:1", downloadName: "ok.md",
  };
  const malformed = { id: "bad\nid", name: "bad.md", mediaType: "text/markdown", sizeBytes: 1, preview: "available" as const };
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [valid, malformed] }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  assert.equal(tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-item").length, 1);
  const chips = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "status-chip").map((node) => node.children.join(""));
  assert.ok(chips.some((text) => text.includes("1 hidden")));
});

test("opens multi-tab previews and switches between them (ADR #114)", async () => {
  const first = { ...artifact, id: "workspace:a", name: "a.md" };
  const second = { ...artifact, id: "workspace:b", name: "b.md" };
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [first, second] }),
    previewArtifact: async (id: string) => ({
      ok: true,
      value: { type: "markdown", renderer: "ui-primitives", content: `# ${id}`, truncated: false, policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] } },
    }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  // Open the second artifact: both tabs exist now.
  const selects = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-select");
  const secondSelect = selects.find((node) => node.children.join("") === "b.md")!;
  await act(async () => { secondSelect.props.onClick(); });
  await act(async () => {});
  const tabs = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-tab");
  assert.ok(tabs.length >= 2, "two tabs are open");
  const active = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-tab" && node.props["data-active"] === "true");
  assert.equal(active.length, 1);
  // Close the active tab: the other tab becomes active.
  const closeButtons = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-tab-close");
  const activeClose = closeButtons.find((node) => node.props["aria-label"]?.includes("b.md"))!;
  await act(async () => { activeClose.props.onClick(); });
  await act(async () => {});
  const remaining = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-tab");
  assert.equal(remaining.length, 1);
  assert.ok(remaining[0].props["data-active"] === "true");
});

test("formatRelativeTime humanizes mtimes and never emits undefined", () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now - 30_000, now), "just now");
  assert.equal(formatRelativeTime(now - 5 * 60_000, now), "5m ago");
  assert.equal(formatRelativeTime(now - 2 * 3600_000, now), "2h ago");
  assert.equal(formatRelativeTime(now - 3 * 86_400_000, now), "3d ago");
  assert.equal(formatRelativeTime(now - 2 * 7 * 86_400_000, now), "2w ago");
  assert.equal(formatRelativeTime(undefined, now), "—");
  assert.equal(formatRelativeTime(Number.NaN, now), "—");
  assert.equal(formatRelativeTime(now + 3_600_000, now), "just now", "future/clock-skewed stamps clamp to just now");
});

test("shows size · modified time · preview status per row", async () => {
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const markdownPreview = {
    type: "markdown",
    renderer: "ui-primitives",
    content: "# Report",
    truncated: false,
    policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] },
  } as const;
  const recent = { ...artifact, mtimeMs: Date.now() - 2 * 3600_000 };
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [recent] }),
    previewArtifact: async () => ({ ok: true, value: markdownPreview }),
  };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const metas = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-meta").map((node) => node.children.join(""));
  assert.ok(metas.some((text) => text.includes("12 B") && text.includes("2h ago") && text.includes("Preview available")), `row meta is size · mtime · status: ${JSON.stringify(metas)}`);

  // A missing mtime renders "—" instead of `undefined` (defensive rendering).
  const noMtime = { ...artifact, id: "workspace:nomtime", name: "plain.txt", mtimeMs: undefined };
  const remoteNoMtime = {
    artifactMetadata: async () => ({ ok: true, value: [noMtime] }),
    previewArtifact: async () => ({ ok: true, value: markdownPreview }),
  };
  const renderNoMtime = createWorkspaceArtifactSurfaceComponent(remoteNoMtime, primitives, { refreshMs: 0 });
  let treeNoMtime!: TestRenderer.ReactTestRenderer;
  await act(async () => { treeNoMtime = TestRenderer.create(createElement(renderNoMtime, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const metasNoMtime = treeNoMtime.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-meta").map((node) => node.children.join(""));
  assert.ok(metasNoMtime.some((text) => text.includes("· — ·")), `missing mtime renders —: ${JSON.stringify(metasNoMtime)}`);
  assert.equal(metasNoMtime.some((text) => text.includes("undefined")), false, "no literal undefined in row meta");
});

test("shows friendly 'preview unavailable' copy for an unsupported artifact, not an error", async () => {
  const unsupported = { ...artifact, id: "workspace:unsupported", name: "blob.dat", mediaType: "application/octet-stream", preview: "unsupported" as const, resourceId: undefined };
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [unsupported] }),
    previewArtifact: async () => ({ ok: true, value: { type: "unsupported", reason: "unsupported format", mediaType: "application/octet-stream", size: 12 } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const statusTexts = tree.root.findAll((node) => node.type === "p").map((node) => node.children.join(""));
  assert.ok(statusTexts.some((text) => text.includes("Preview unavailable")), "unsupported shows friendly preview-unavailable copy");
  const chips = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-status-chip").map((node) => node.children.join(""));
  assert.ok(chips.some((text) => text.includes("Preview unavailable")), "row chip shows the friendly label, not the raw enum");
});

test("binary artifact with a resourceId still offers the download action", async () => {
  const binary = { ...artifact, id: "workspace:binary", name: "chart.png", mediaType: "image/png", altText: "Chart" };
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [binary] }),
    previewArtifact: async () => ({ ok: true, value: { type: "binary", mediaType: "image/png", resourceId: "resource-1", version: "12:1:1:1", expiresAt: 1 } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const buttonTexts = tree.root.findAll((node) => node.type === "button").map((node) => node.children.join(""));
  assert.ok(buttonTexts.includes("Download"), "binary artifact keeps its download action");
  assert.ok(buttonTexts.includes("Copy path"), "detail panel offers the copy-path action");
});

test("shows a degraded notice when the artifact backend errors", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: false, error: { code: "PROJECT_UNAVAILABLE", message: "Workspace Session is unavailable", details: {} } }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const texts = tree.root.findAll((node) => node.type === "p").map((node) => node.children.join(""));
  assert.ok(texts.some((text) => text.includes("Workspace artifacts are unavailable")), "backend error degrades to the unavailable notice");
});

test("copy-path button copies the selected artifact name via the clipboard", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [artifact] }),
    previewArtifact: async () => ({
      ok: true,
      value: {
        type: "markdown",
        renderer: "ui-primitives",
        content: "# Report",
        truncated: false,
        policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] },
      },
    }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const copyButton = tree.root.find((node) => node.props["data-dsh-workspace"] === "artifact-copy-path");
  let copied = "";
  const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async (text: string) => { copied = text; } }, configurable: true });
  try {
    await act(async () => { copyButton.props.onClick(); });
    await act(async () => {});
    assert.equal(copied, "report.md");
    const statusTexts = tree.root.findAll((node) => node.type === "p").map((node) => node.children.join(""));
    assert.ok(statusTexts.some((text) => text.includes("Path copied")), "confirmation notice shown after a successful copy");
  } finally {
    if (originalClipboard) Object.defineProperty(globalThis.navigator, "clipboard", originalClipboard);
    else delete (globalThis.navigator as { clipboard?: unknown }).clipboard;
  }
});

test("copy-path falls back to a friendly notice when the clipboard API is unavailable", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [artifact] }),
    previewArtifact: async () => ({
      ok: true,
      value: { type: "markdown", renderer: "ui-primitives", content: "# Report", truncated: false, policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] } },
    }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const copyButton = tree.root.find((node) => node.props["data-dsh-workspace"] === "artifact-copy-path");
  const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
  if (originalClipboard) delete (globalThis.navigator as { clipboard?: unknown }).clipboard;
  try {
    await act(async () => { copyButton.props.onClick(); });
    await act(async () => {});
    const statusTexts = tree.root.findAll((node) => node.type === "p").map((node) => node.children.join(""));
    assert.ok(statusTexts.some((text) => text.includes("Copy is unavailable")), "falls back to the select-to-copy notice");
  } finally {
    if (originalClipboard) Object.defineProperty(globalThis.navigator, "clipboard", originalClipboard);
  }
});

test("locale swap re-renders artifact copy (zh), restoring en afterwards", async () => {
  setWorkspaceLocale("en");
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [] }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const emptyTexts = () => tree.root.findAll((node) => node.props["data-dsh-workspace"] === "empty-state").map((node) => node.children.join(""));
  assert.ok(emptyTexts().some((text) => text.includes("No session artifacts yet")), "starts in English");
  try {
    await act(async () => { setWorkspaceLocale("zh"); });
    await act(async () => {});
    assert.ok(emptyTexts().some((text) => text.includes("还没有会话产物")), "locale swap re-renders the zh copy");
  } finally {
    await act(async () => { setWorkspaceLocale("en"); });
  }
});

test("empty state also explains the tool-activity gap", async () => {
  const remote = {
    artifactMetadata: async () => ({ ok: true, value: [] }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-1" })); });
  await act(async () => {});
  const explainer = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-empty-explainer").map((node) => node.children.join(""));
  assert.ok(explainer.some((text) => text.includes("Artifacts appear when the agent creates files")), "empty state carries the gap explainer");
});
