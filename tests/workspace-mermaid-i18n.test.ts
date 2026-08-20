import assert from "node:assert/strict";
import test from "node:test";

import { mermaidTheme, shellIsDark, MERMAID_VENDOR_URL } from "../src/web/workspace-mermaid.ts";
import { setWorkspaceLocale, t, workspaceLocale } from "../src/web/workspace-i18n.ts";

test("mermaid vendor URL is the fixed same-origin route", () => {
  assert.equal(MERMAID_VENDOR_URL, "/workspace/vendor/mermaid.js");
});

test("mermaidTheme maps shell theme to mermaid theme", () => {
  assert.equal(mermaidTheme(true), "dark");
  assert.equal(mermaidTheme(false), "default");
});

test("shellIsDark falls back to light when matchMedia is absent", () => {
  // In a Node test runner there is no window, so the fallback is false.
  assert.equal(shellIsDark(), false);
});

test("i18n resolves English and Chinese copy and interpolates placeholders", () => {
  setWorkspaceLocale("en");
  assert.equal(workspaceLocale(), "en");
  assert.equal(t("changes.title"), "Changes");
  assert.equal(t("summary.files", { count: 3 }), "3 files");
  assert.equal(t("memory.forgetDescription", { scope: "Session" }), "This will tombstone 1 record in Session. Existing exports or model turns cannot be recalled.");

  setWorkspaceLocale("zh");
  assert.equal(workspaceLocale(), "zh");
  assert.equal(t("changes.title"), "变更");
  assert.equal(t("summary.files", { count: 3 }), "3 个文件");

  // Unknown keys fall back to the key itself.
  assert.equal(t("does.not.exist" as never), "does.not.exist");

  setWorkspaceLocale("en");
});

test("mermaid block carries data-dsh-source for theme re-render (ADR 0014 #4)", async () => {
  // Simulate the DOM a browser provides: a pre > code.language-mermaid.
  const pre = { tagName: "PRE", className: "language-mermaid", replaceWith: (node: unknown) => { pre.replaced = node; }, querySelector: (sel: string) => sel === "code" ? { textContent: "graph TD\n  A-->B" } : null } as unknown as HTMLPreElement & { replaced?: unknown };
  // Without window/document, loadVendor resolves false and the block is
  // counted but not rendered — the important contract is that the renderer
  // path would attach data-dsh-source. We exercise the pure helpers instead:
  // the renderer emits the source attribute and retheme reads it back.
  const { renderWorkspaceMarkdown } = await import("../src/web/workspace-markdown.ts");
  const html = renderWorkspaceMarkdown("```mermaid\ngraph TD\n  A-->B\n```");
  assert.ok(html.includes('data-dsh-source="graph TD'));
  assert.ok(html.includes("A--&gt;B") || html.includes("A-->B"));
  void pre;
});
