import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  createWorkspaceArtifactSurfaceComponent,
  workspaceArtifactCategory,
  workspaceArtifactPreviewDescriptor,
  workspaceArtifactResourceUrl,
} from "../src/web/workspace-artifact-surface.ts";

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
