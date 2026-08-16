import { createElement, type ComponentType, type ExoticComponent, type ReactNode } from "react";

import type { PreviewDescriptor } from "../domain/preview.ts";

type WorkspacePrimitive<Props extends object> = ComponentType<Props> | ExoticComponent<Props>;

export interface WorkspacePrimitiveSet {
  readonly MarkdownText: WorkspacePrimitive<{ readonly text: string; readonly streaming?: boolean }>;
  readonly CodeBlock: WorkspacePrimitive<{ readonly code: string; readonly lang?: string }>;
  readonly JsonTree: WorkspacePrimitive<{ readonly data: object | readonly unknown[]; readonly label?: string; readonly copyable?: boolean; readonly expandTopLevel?: boolean }>;
}

export interface WorkspacePreviewRenderOptions {
  readonly resourcePath?: string;
  readonly downloadName?: string;
  readonly altText?: string;
}

/** Remove Markdown image fetches before handing bounded content to the Harness renderer. */
export function sanitizeWorkspaceMarkdown(text: string): string {
  const withoutRemoteDefinitions = text.replace(/^\s{0,3}\[((?:\\.|[^\]])+)\]:\s*<?https?:\/\/[^>\s]+>?[^\r\n]*$/gimu, "");
  const readDelimited = (start: number, open: string, close: string): number => {
    let depth = 0;
    for (let index = start; index < withoutRemoteDefinitions.length; index += 1) {
      if (withoutRemoteDefinitions[index] === "\\") { index += 1; continue; }
      if (withoutRemoteDefinitions[index] === open) depth += 1;
      else if (withoutRemoteDefinitions[index] === close && --depth === 0) return index;
    }
    return -1;
  };
  let sanitized = "";
  for (let index = 0; index < withoutRemoteDefinitions.length;) {
    if (withoutRemoteDefinitions[index] === "!" && withoutRemoteDefinitions[index + 1] === "[") {
      const altEnd = readDelimited(index + 1, "[", "]");
      if (altEnd !== -1) {
        const destinationStart = altEnd + 1;
        const destinationEnd = withoutRemoteDefinitions[destinationStart] === "("
          ? readDelimited(destinationStart, "(", ")")
          : withoutRemoteDefinitions[destinationStart] === "["
            ? readDelimited(destinationStart, "[", "]")
            : -1;
        const alt = withoutRemoteDefinitions.slice(index + 2, altEnd);
        const hasExplicitDestination = withoutRemoteDefinitions[destinationStart] === "(" || withoutRemoteDefinitions[destinationStart] === "[";
        if (!hasExplicitDestination || destinationEnd !== -1) {
          sanitized += alt;
          index = destinationEnd === -1 ? altEnd + 1 : destinationEnd + 1;
          continue;
        }
      }
    }
    sanitized += withoutRemoteDefinitions[index];
    index += 1;
  }
  return sanitized;
}

function status(message: string): ReactNode {
  return createElement("p", { role: "status", "data-dsh-workspace-preview": "status" }, message);
}

function csvTable(columns: readonly string[], rows: readonly (readonly string[])[], truncated: boolean): ReactNode {
  const table = createElement(
    "table",
    { "data-dsh-workspace-preview": "csv" },
    createElement("caption", null, truncated ? "Workspace CSV preview (additional rows omitted)" : "Workspace CSV preview"),
    createElement("thead", null, createElement("tr", null, columns.map((column, index) => createElement("th", { key: index, scope: "col" }, column)))),
    createElement("tbody", null, rows.map((row, rowIndex) => createElement("tr", { key: rowIndex }, row.map((cell, columnIndex) => createElement("td", { key: columnIndex }, cell))))),
  );
  return createElement(
    "div",
    { role: "region", "aria-label": "Workspace CSV preview", "data-dsh-workspace-preview": "csv-scroll", tabIndex: 0, style: { overflowX: "auto", maxWidth: "100%" } },
    table,
  );
}

function primitiveElement<Props extends object>(primitive: WorkspacePrimitive<Props>, props: Props): ReactNode {
  return createElement(primitive as ComponentType<Props>, props);
}

function resourceHref(descriptor: Extract<PreviewDescriptor, { type: "binary" }>, options: WorkspacePreviewRenderOptions, download: boolean): string | undefined {
  const path = options.resourcePath ?? "/workspace/resource";
  if (typeof path !== "string" || !/^\/[A-Za-z0-9._/-]+$/u.test(path) || path.endsWith("/")) return undefined;
  const url = new URL(path, "http://workspace.local");
  url.searchParams.set("id", descriptor.resourceId);
  url.searchParams.set("type", descriptor.mediaType);
  if (download) url.searchParams.set("download", "1");
  return `${url.pathname}${url.search}`;
}

function imageAlt(descriptor: Extract<PreviewDescriptor, { type: "binary" }>, options: WorkspacePreviewRenderOptions): string {
  const value = options.altText ?? descriptor.path.split("/").pop() ?? "Workspace image";
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 180) || "Workspace image";
}

function withTruncation(content: ReactNode, truncated: boolean): ReactNode {
  if (!truncated) return content;
  return createElement(
    "div",
    { "data-dsh-workspace-preview": "truncated" },
    content,
    createElement("p", { role: "status" }, "Preview truncated; additional content omitted."),
  );
}

/** Render only bounded, already-authorized Host data through public UI primitives. */
export function createWorkspacePreviewRenderer(primitives: WorkspacePrimitiveSet, descriptor: PreviewDescriptor, options: WorkspacePreviewRenderOptions = {}): unknown {
  if (descriptor.type === "error") return status(descriptor.message);
  if (descriptor.type === "unsupported") {
    const metadata = [descriptor.mediaType, descriptor.size === undefined ? undefined : `${descriptor.size} bytes`].filter(Boolean).join(", ");
    return status(`Preview unavailable: ${descriptor.reason}${metadata ? ` (${metadata})` : ""}. Download is unavailable for this file.`);
  }
  if (descriptor.type === "text") return withTruncation(primitiveElement(primitives.CodeBlock, { code: descriptor.content, lang: descriptor.language }), descriptor.truncated);
  if (descriptor.type === "markdown") return withTruncation(primitiveElement(primitives.MarkdownText, { text: sanitizeWorkspaceMarkdown(descriptor.content), streaming: false }), descriptor.truncated);
  if (descriptor.type === "json") {
    const data = descriptor.value !== null && typeof descriptor.value === "object" ? descriptor.value as object | readonly unknown[] : { value: descriptor.value };
    return primitiveElement(primitives.JsonTree, { data, label: "Workspace JSON", copyable: true, expandTopLevel: true });
  }
  if (descriptor.type === "csv") return withTruncation(csvTable(descriptor.columns, descriptor.rows, descriptor.truncated), descriptor.truncated);
  const resourceUrl = resourceHref(descriptor, options, false);
  if (!resourceUrl) return status("Preview resource is unavailable");
  if (descriptor.mediaType.startsWith("image/")) return createElement("img", { src: resourceUrl, alt: imageAlt(descriptor, options), loading: "lazy" });
  if (descriptor.mediaType === "application/pdf") return createElement("iframe", { src: resourceUrl, title: "Workspace PDF preview" });
  const downloadUrl = resourceHref(descriptor, options, true);
  return createElement("a", { href: downloadUrl, download: options.downloadName }, `Download ${options.downloadName ?? "workspace file"}`);
}
