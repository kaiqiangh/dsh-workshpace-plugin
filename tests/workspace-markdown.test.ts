import assert from "node:assert/strict";
import test from "node:test";

import { renderWorkspaceMarkdown, resolveWorkspaceMarkdownImage, safeWorkspaceUrl, escapeHtml, renderWorkspaceInline } from "../src/web/workspace-markdown.ts";

test("renders GFM subset with escaped HTML and safe links", () => {
  const html = renderWorkspaceMarkdown("# Title\n\nParagraph with <script>alert(1)</script> and [link](https://example.com).\n\n```js\nconst x = 1 < 2;\n```\n\n- one\n- two\n");
  assert.ok(html.includes("<h1>Title</h1>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes('<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>'));
  assert.ok(html.includes('<pre class="language-js"><code>const x = 1 &lt; 2;'));
  assert.ok(html.includes("<ul><li>one</li><li>two</li></ul>"));
});

test("drops unsafe link and image targets", () => {
  const html = renderWorkspaceMarkdown("[bad](javascript:alert(1)) ![img](javascript:alert(2))");
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("<a" ) === false);
});

test("keeps relative document links inert in the review surface", () => {
  const html = renderWorkspaceMarkdown("[context](./CONTEXT.md) [anchor](#section) [web](https://example.com)");
  assert.ok(!html.includes('href="./CONTEXT.md"'));
  assert.ok(html.includes('href="#section"'));
  assert.ok(html.includes('href="https://example.com"'));
});

test("mermaid fences carry the source data attribute for re-render", () => {
  const html = renderWorkspaceMarkdown("```mermaid\ngraph TD\n  A-->B\n```");
  const tilde = renderWorkspaceMarkdown("~~~mermaid\ngraph TD\n  A-->B\n~~~");
  assert.ok(html.includes('class="language-mermaid"'));
  assert.ok(html.includes("data-dsh-source"));
  assert.ok(html.includes("graph TD"));
  assert.ok(tilde.includes('class="language-mermaid"'));
});

test("resolveWorkspaceMarkdownImage handles absolute, relative, and escaping srcs", () => {
  assert.deepEqual(resolveWorkspaceMarkdownImage("docs/readme.md", "https://x.com/a.png"), { kind: "absolute" });
  assert.deepEqual(resolveWorkspaceMarkdownImage("docs/readme.md", "./img/a.png"), { kind: "relative", path: "docs/img/a.png", suffix: "" });
  assert.deepEqual(resolveWorkspaceMarkdownImage("docs/readme.md", "/img/a.png"), { kind: "relative", path: "img/a.png", suffix: "" });
  // `..` from docs/ escapes the project root.
  assert.deepEqual(resolveWorkspaceMarkdownImage("docs/readme.md", "../../evil.png"), { kind: "escape" });
  assert.deepEqual(resolveWorkspaceMarkdownImage("docs/readme.md", "img/a.png?v=2#frag"), { kind: "relative", path: "docs/img/a.png", suffix: "?v=2#frag" });
  assert.deepEqual(resolveWorkspaceMarkdownImage("readme.md", "#anchor"), { kind: "absolute" });
});

test("resolveWorkspaceMarkdownImage decodes percent-encoded paths", () => {
  assert.deepEqual(resolveWorkspaceMarkdownImage("docs/readme.md", "./my%20image.png"), { kind: "relative", path: "docs/my image.png", suffix: "" });
});

test("safeWorkspaceUrl allows http/https/mailto and relative, rejects dangerous schemes", () => {
  assert.equal(safeWorkspaceUrl("https://example.com"), "https://example.com");
  assert.equal(safeWorkspaceUrl("mailto:a@b.c"), "mailto:a@b.c");
  assert.equal(safeWorkspaceUrl("./img.png"), "./img.png");
  assert.equal(safeWorkspaceUrl("#frag"), "#frag");
  assert.equal(safeWorkspaceUrl("javascript:alert(1)"), null);
  assert.equal(safeWorkspaceUrl("data:text/html,x"), null);
  assert.equal(safeWorkspaceUrl(""), null);
});

test("escapeHtml escapes HTML special characters", () => {
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("renderWorkspaceInline supports images with a resolve hook", () => {
  const out = renderWorkspaceInline("![alt](./img.png)", { resolveImageSrc: () => "/workspace/resource?id=x&type=image%2Fpng" });
  assert.ok(out.includes('<img alt="alt" src="/workspace/resource?id=x&amp;type=image%2Fpng" />'));
  const dropped = renderWorkspaceInline("![alt](./img.png)", { resolveImageSrc: () => null });
  assert.ok(!dropped.includes("<img"));
  assert.ok(dropped.includes("alt"));
});
