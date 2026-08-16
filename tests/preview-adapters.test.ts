import test from "node:test";
import assert from "node:assert/strict";

import type { PreviewDescriptor } from "../src/domain/preview.ts";
import { createWorkspacePreviewRenderer, sanitizeWorkspaceMarkdown, type WorkspacePrimitiveSet } from "../src/web/workspace-preview-adapters.ts";

const path = "preview.md" as PreviewDescriptor extends { path: infer Path } ? Path : never;
const primitives: WorkspacePrimitiveSet = {
  MarkdownText() { return null; },
  CodeBlock() { return null; },
  JsonTree() { return null; },
};

function element(value: unknown): { readonly type: unknown; readonly props: Record<string, unknown> } {
  return value as { readonly type: unknown; readonly props: Record<string, unknown> };
}

test("adapts bounded Markdown, code, and JSON through public primitive seams", () => {
  const markdown = {
    type: "markdown", path, renderer: "ui-primitives", content: "![remote](https://remote.invalid/a.png)\n# title", truncated: false,
    policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] as const },
  } as PreviewDescriptor;
  const markdownElement = element(createWorkspacePreviewRenderer(primitives, markdown));
  assert.equal(markdownElement.type, primitives.MarkdownText);
  assert.equal((markdownElement.props.text as string).includes("remote.invalid"), false);
  assert.equal(markdownElement.props.streaming, false);
  const codeElement = element(createWorkspacePreviewRenderer(primitives, { type: "text", path, renderer: "ui-primitives", content: "const x = 1", truncated: false }));
  assert.equal(codeElement.type, primitives.CodeBlock);
  assert.deepEqual(codeElement.props, { code: "const x = 1", lang: undefined });
  const truncatedText = element(createWorkspacePreviewRenderer(primitives, { type: "text", path, renderer: "ui-primitives", content: "partial", truncated: true }));
  assert.equal(truncatedText.props["data-dsh-workspace-preview"], "truncated");
  assert.equal(element((truncatedText.props.children as readonly unknown[])[1]).props.role, "status");
  const truncatedMarkdown = element(createWorkspacePreviewRenderer(primitives, { ...markdown, truncated: true }));
  assert.equal(truncatedMarkdown.props["data-dsh-workspace-preview"], "truncated");
  const jsonElement = element(createWorkspacePreviewRenderer(primitives, { type: "json", path, renderer: "ui-primitives", value: { ok: true } }));
  assert.equal(jsonElement.type, primitives.JsonTree);
  assert.equal(jsonElement.props.expandTopLevel, true);
});

test("keeps CSV accessible and binary states explicit", () => {
  const csv = element(createWorkspacePreviewRenderer(primitives, { type: "csv", path: "data.csv" as never, renderer: "ui-primitives", columns: ["name"], rows: [["a"]], truncated: true }));
  assert.equal(csv.props["data-dsh-workspace-preview"], "truncated");
  const csvScroll = element((csv.props.children as readonly unknown[])[0]);
  assert.equal((csvScroll.props.style as { overflowX: string }).overflowX, "auto");
  const csvTable = element(csvScroll.props.children);
  const csvCaption = element((csvTable.props.children as readonly unknown[])[0]);
  assert.match(String(csvCaption.props.children), /additional rows omitted/);
  const image = element(createWorkspacePreviewRenderer(primitives, { type: "binary", path: "image.png" as never, mediaType: "image/png", resourceId: "opaque", version: "v1", expiresAt: 1 }, { resourcePath: "/workspace/resource", altText: "Chart" }));
  assert.equal((image.props.src as string), "/workspace/resource?id=opaque&type=image%2Fpng");
  assert.equal(image.props.alt, "Chart");
  const invalid = element(createWorkspacePreviewRenderer(primitives, { type: "binary", path: "image.png" as never, mediaType: "image/png", resourceId: "opaque", version: "v1", expiresAt: 1 }, { resourcePath: "https://evil.invalid/resource" }));
  assert.equal(invalid.props.role, "status");
  const unsupported = createWorkspacePreviewRenderer(primitives, { type: "unsupported", path: "archive.zip" as never, reason: "unsupported-binary", mediaType: "application/octet-stream" });
  assert.equal((unsupported as { props: { role: string } }).props.role, "status");
  assert.match(String((unsupported as { props: { children: unknown } }).props.children), /Download is unavailable/);
});

test("sanitizes Markdown images without touching links", () => {
  assert.equal(
    sanitizeWorkspaceMarkdown("![x](https://example.com/x.png) [link](https://example.com) ![y][remote]\n[remote]: https://example.com/y.png\n![a [b]](https://evil.invalid/x.png)\n![shortcut]\n[shortcut]: <https://evil.invalid/shortcut.png>"),
    "x [link](https://example.com) y\n\na [b]\nshortcut\n",
  );
});
