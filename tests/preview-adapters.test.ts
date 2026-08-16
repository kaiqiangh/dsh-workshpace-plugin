import test from "node:test";
import assert from "node:assert/strict";

import type { PreviewDescriptor } from "../src/domain/preview.ts";
import { createWorkspacePreviewRenderer, sanitizeWorkspaceMarkdown, type WorkspacePrimitiveSet } from "../src/web/workspace-preview-adapters.ts";

const path = "preview.md" as PreviewDescriptor extends { path: infer Path } ? Path : never;
const calls: Record<string, unknown> = {};
const primitives: WorkspacePrimitiveSet = {
  MarkdownText(props) { calls.markdown = props; return { kind: "MarkdownText", props }; },
  CodeBlock(props) { calls.code = props; return { kind: "CodeBlock", props }; },
  JsonTree(props) { calls.json = props; return { kind: "JsonTree", props }; },
};

test("adapts bounded Markdown, code, and JSON through public primitive seams", () => {
  const markdown = {
    type: "markdown", path, renderer: "ui-primitives", content: "![remote](https://remote.invalid/a.png)\n# title", truncated: false,
    policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] as const },
  } as PreviewDescriptor;
  createWorkspacePreviewRenderer(primitives, markdown);
  assert.equal((calls.markdown as { text: string }).text.includes("remote.invalid"), false);
  assert.equal((calls.markdown as { streaming: boolean }).streaming, false);
  createWorkspacePreviewRenderer(primitives, { type: "text", path, renderer: "ui-primitives", content: "const x = 1", truncated: false });
  assert.deepEqual(calls.code, { code: "const x = 1", lang: undefined });
  createWorkspacePreviewRenderer(primitives, { type: "json", path, renderer: "ui-primitives", value: { ok: true } });
  assert.equal((calls.json as { expandTopLevel: boolean }).expandTopLevel, true);
});

test("keeps CSV accessible and binary states explicit", () => {
  const csv = createWorkspacePreviewRenderer(primitives, { type: "csv", path: "data.csv" as never, renderer: "ui-primitives", columns: ["name"], rows: [["a"]], truncated: false });
  assert.equal((csv as { props: { "data-dsh-workspace-preview": string } }).props["data-dsh-workspace-preview"], "csv");
  const image = createWorkspacePreviewRenderer(primitives, { type: "binary", path: "image.png" as never, mediaType: "image/png", resourceId: "opaque", version: "v1", expiresAt: 1 }, { resourceUrl: "/workspace/resource?id=opaque", downloadName: "image.png" });
  assert.equal((image as { props: { src: string; alt: string } }).props.src, "/workspace/resource?id=opaque");
  assert.equal((image as { props: { src: string; alt: string } }).props.alt, "Workspace image");
  const unsupported = createWorkspacePreviewRenderer(primitives, { type: "unsupported", path: "archive.zip" as never, reason: "unsupported-binary", mediaType: "application/octet-stream" });
  assert.equal((unsupported as { props: { role: string } }).props.role, "status");
});

test("sanitizes Markdown images without touching links", () => {
  assert.equal(
    sanitizeWorkspaceMarkdown("![x](https://example.com/x.png) [link](https://example.com) ![y][remote]\n[remote]: https://example.com/y.png"),
    "x [link](https://example.com) y\n",
  );
});
