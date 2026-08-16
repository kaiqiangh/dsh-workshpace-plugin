import { createElement } from "react";

import type { PreviewDescriptor } from "../domain/preview.ts";

export interface WorkspacePrimitiveSet {
  readonly MarkdownText: (props: { readonly text: string; readonly streaming?: boolean }) => unknown;
  readonly CodeBlock: (props: { readonly code: string; readonly lang?: string }) => unknown;
  readonly JsonTree: (props: { readonly data: object | readonly unknown[]; readonly label?: string; readonly copyable?: boolean; readonly expandTopLevel?: boolean }) => unknown;
}

export interface WorkspacePreviewRenderOptions {
  readonly resourceUrl?: string;
  readonly downloadName?: string;
}

/** Remove Markdown image fetches before handing bounded content to the Harness renderer. */
export function sanitizeWorkspaceMarkdown(text: string): string {
  const withoutRemoteDefinitions = text.replace(/^\s{0,3}\[[^\]]+\]:\s*https?:\/\/\S+.*$/gimu, "");
  return withoutRemoteDefinitions
    .replace(/!\[([^\]]*)\]\([^)]*\)/giu, "$1")
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/giu, "$1");
}

function status(message: string): unknown {
  return createElement("p", { role: "status", "data-dsh-workspace-preview": "status" }, message);
}

function csvTable(columns: readonly string[], rows: readonly (readonly string[])[]): unknown {
  return createElement(
    "table",
    { "data-dsh-workspace-preview": "csv" },
    createElement("caption", null, "Workspace CSV preview"),
    createElement("thead", null, createElement("tr", null, columns.map((column, index) => createElement("th", { key: index, scope: "col" }, column)))),
    createElement("tbody", null, rows.map((row, rowIndex) => createElement("tr", { key: rowIndex }, row.map((cell, columnIndex) => createElement("td", { key: columnIndex }, cell))))),
  );
}

/** Render only bounded, already-authorized Host data through public UI primitives. */
export function createWorkspacePreviewRenderer(primitives: WorkspacePrimitiveSet, descriptor: PreviewDescriptor, options: WorkspacePreviewRenderOptions = {}): unknown {
  if (descriptor.type === "error") return status(descriptor.message);
  if (descriptor.type === "unsupported") return status(`Preview unavailable: ${descriptor.reason}`);
  if (descriptor.type === "text") return primitives.CodeBlock({ code: descriptor.content, lang: descriptor.language });
  if (descriptor.type === "markdown") return primitives.MarkdownText({ text: sanitizeWorkspaceMarkdown(descriptor.content), streaming: false });
  if (descriptor.type === "json") {
    const data = descriptor.value !== null && typeof descriptor.value === "object" ? descriptor.value as object | readonly unknown[] : { value: descriptor.value };
    return primitives.JsonTree({ data, label: "Workspace JSON", copyable: true, expandTopLevel: true });
  }
  if (descriptor.type === "csv") return csvTable(descriptor.columns, descriptor.rows);
  if (!options.resourceUrl) return status("Preview resource is unavailable");
  if (descriptor.mediaType.startsWith("image/")) return createElement("img", { src: options.resourceUrl, alt: "Workspace image", loading: "lazy" });
  if (descriptor.mediaType === "application/pdf") return createElement("iframe", { src: options.resourceUrl, title: "Workspace PDF preview" });
  return createElement("a", { href: options.resourceUrl, download: options.downloadName }, `Download ${options.downloadName ?? "workspace file"}`);
}
