import { createElement, useEffect, useRef, useState, type ComponentType, type ExoticComponent, type ReactNode } from "react";

import type { PreviewDescriptor } from "../domain/preview.ts";
import { renderWorkspaceMarkdown, resolveWorkspaceMarkdownImage, safeWorkspaceUrl } from "./workspace-markdown.ts";
import { enhanceMermaidBlocks, mermaidTheme, rethemeMermaidBlocks, shellIsDark, watchShellTheme } from "./workspace-mermaid.ts";
import { t } from "./workspace-i18n.ts";
import { workspaceResourceUrl } from "./workspace-deliverables.ts";

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

/**
 * Remove remote Markdown image fetches before rendering, while preserving
 * relative images so the v0.6 renderer can resolve them to same-origin opaque
 * resource URLs. Relative srcs (`./x.png`, `../x.png`, `/x.png`, plain
 * filenames) pass through unchanged; absolute http(s)/data:/other-scheme srcs
 * and remote reference definitions are stripped to their alt text. The
 * renderer's `resolveImageSrc` hook then decides what actually renders.
 */
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
        const isRemote = hasExplicitDestination && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(withoutRemoteDefinitions.slice(destinationStart + 1, destinationEnd === -1 ? undefined : destinationEnd).trim());
        if ((!hasExplicitDestination || destinationEnd !== -1) && isRemote) {
          // Remote image: keep only the alt text (privacy policy).
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
    createElement("caption", null, truncated ? t("preview.csvTruncatedTitle") : t("preview.csvTitle")),
    createElement("thead", null, createElement("tr", null, columns.map((column, index) => createElement("th", { key: index, scope: "col" }, column)))),
    createElement("tbody", null, rows.map((row, rowIndex) => createElement("tr", { key: rowIndex }, row.map((cell, columnIndex) => createElement("td", { key: columnIndex }, cell))))),
  );
  return createElement(
    "div",
    { role: "region", "aria-label": t("preview.csvTitle"), "data-dsh-workspace-preview": "csv-scroll", tabIndex: 0, style: { overflowX: "auto", maxWidth: "100%" } },
    table,
  );
}

function primitiveElement<Props extends object>(primitive: WorkspacePrimitive<Props>, props: Props): ReactNode {
  return createElement(primitive as ComponentType<Props>, props);
}

function resourceHref(descriptor: Extract<PreviewDescriptor, { type: "binary" }>, options: WorkspacePreviewRenderOptions, download: boolean): string | undefined {
  return workspaceResourceUrl(descriptor.resourceId, descriptor.mediaType, { download, resourcePath: options.resourcePath });
}

function imageAlt(descriptor: Extract<PreviewDescriptor, { type: "binary" }>, options: WorkspacePreviewRenderOptions): string {
  const value = options.altText ?? descriptor.path.split("/").pop() ?? t("preview.imageAlt");
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 180) || t("preview.imageAlt");
}

function withTruncation(content: ReactNode, truncated: boolean): ReactNode {
  if (!truncated) return content;
  return createElement(
    "div",
    { "data-dsh-workspace-preview": "truncated" },
    content,
    createElement("p", { role: "status" }, t("preview.truncatedNote")),
  );
}

/** Render only bounded, already-authorized Host data through public UI primitives. */
export function createWorkspacePreviewRenderer(primitives: WorkspacePrimitiveSet, descriptor: PreviewDescriptor, options: WorkspacePreviewRenderOptions = {}): unknown {
  if (descriptor.type === "error") return status(descriptor.message);
  if (descriptor.type === "unsupported") {
    const metadata = [descriptor.mediaType, descriptor.size === undefined ? undefined : `${descriptor.size} bytes`].filter(Boolean).join(", ");
    return status(t("preview.previewUnavailable", { reason: descriptor.reason }) + (metadata ? ` (${metadata})` : ""));
  }
  if (descriptor.type === "text") return withTruncation(primitiveElement(primitives.CodeBlock, { code: descriptor.content, lang: descriptor.language }), descriptor.truncated);
  if (descriptor.type === "markdown") {
    // v0.6: render markdown with the Workspace renderer (GFM subset) instead
    // of MarkdownText so relative images resolve to same-origin opaque
    // resource URLs (MarkdownText only renders absolute http(s) images) and
    // mermaid fences can be enhanced. Remote images stay dropped.
    const imageUrls = descriptor.imageUrls;
    const html = renderWorkspaceMarkdown(sanitizeWorkspaceMarkdown(descriptor.content), {
      resolveImageSrc: (src) => {
        const safe = safeWorkspaceUrl(src);
        if (safe === null) return null;
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(safe)) return null; // remote images still dropped
        if (imageUrls && Object.prototype.hasOwnProperty.call(imageUrls, safe)) return imageUrls[safe] ?? null;
        const resolution = resolveWorkspaceMarkdownImage(descriptor.path, safe);
        return resolution.kind === "relative" ? (imageUrls?.[safe] ?? null) : null;
      },
    });
    return withTruncation(
      createElement(WorkspaceMarkdownView, { html }),
      descriptor.truncated,
    );
  }
  if (descriptor.type === "json") {
    const data = descriptor.value !== null && typeof descriptor.value === "object" ? descriptor.value as object | readonly unknown[] : { value: descriptor.value };
    return primitiveElement(primitives.JsonTree, { data, label: t("preview.jsonLabel"), copyable: true, expandTopLevel: true });
  }
  if (descriptor.type === "csv") return withTruncation(csvTable(descriptor.columns, descriptor.rows, descriptor.truncated), descriptor.truncated);
  const resourceUrl = resourceHref(descriptor, options, false);
  if (!resourceUrl) return status(t("preview.resourceUnavailable"));
  if (descriptor.mediaType.startsWith("image/")) return createElement("img", { src: resourceUrl, alt: imageAlt(descriptor, options), loading: "lazy" });
  if (descriptor.mediaType === "application/pdf") return createElement("iframe", { src: resourceUrl, title: t("preview.downloadName") });
  const downloadUrl = resourceHref(descriptor, options, true);
  return createElement("a", { href: downloadUrl, download: options.downloadName }, t("preview.downloadAction", { name: options.downloadName ?? t("preview.downloadName") }));
}

/**
 * Rendered markdown body plus the mermaid enhancement lifecycle: fresh blocks
 * render once per html, completed diagrams re-render on shell theme flips.
 */
export function createWorkspaceMarkdownContent(text: string): ReactNode {
  const html = renderWorkspaceMarkdown(sanitizeWorkspaceMarkdown(text), { resolveImageSrc: () => null });
  return createElement(WorkspaceMarkdownView, { html });
}

function WorkspaceMarkdownView({ html }: { readonly html: string }): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mermaidStatus, setMermaidStatus] = useState<"idle" | "ready" | "fallback">("idle");
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    let active = true;
    void enhanceMermaidBlocks(el, mermaidTheme(shellIsDark())).then((count) => {
      if (!active) return;
      setMermaidStatus(count === 0 ? "idle" : el.querySelector(".dsh-workspace-mermaid") ? "ready" : "fallback");
    });
    const stopTheme = watchShellTheme((isDark) => {
      void rethemeMermaidBlocks(el, mermaidTheme(isDark));
    });
    return () => { active = false; stopTheme(); };
  }, [html]);
  return createElement("div", { "data-dsh-workspace-preview": "markdown" },
    mermaidStatus === "ready" && createElement("p", { role: "status", "data-dsh-workspace-preview": "mermaid-status" }, t("preview.mermaidReady")),
    mermaidStatus === "fallback" && createElement("p", { role: "status", "data-dsh-workspace-preview": "mermaid-status" }, t("preview.mermaidFallback")),
    createElement("div", { ref, dangerouslySetInnerHTML: { __html: html } }),
  );
}
