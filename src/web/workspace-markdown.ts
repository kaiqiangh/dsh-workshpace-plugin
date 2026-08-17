/**
 * Compact zero-dependency markdown renderer for Workspace previews.
 *
 * Why not `MarkdownText` from @deepseek-ai/dsh-client-ui-primitives? That
 * primitive only renders images with an absolute http(s) src and drops every
 * relative/root-relative image — but Workspace previews need to show images
 * that live next to the markdown file, served through the same-origin opaque
 * resource route. So the Workspace surface renders markdown itself (GFM
 * subset: headings, paragraphs, fenced + inline code, bold/italic/strike,
 * links, images, lists, blockquotes, hr, tables) with a `resolveImageSrc`
 * hook that rewrites relative srcs to opaque resource URLs.
 *
 * All HTML is escaped before transformation — the output only ever contains
 * the renderer's own tags (ADR 0011 keeps the surface zero-dependency and
 * privacy-bounded). Pure and exported for tests.
 */

/** Escape HTML special characters. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** How one image src resolves against the markdown file's location. */
export type WorkspaceMarkdownImageResolution =
  /** Scheme URL or fragment: the browser resolves it as-is. */
  | { readonly kind: "absolute" }
  /** Workspace-relative target: resolved path plus any ?query#fragment suffix. */
  | { readonly kind: "relative"; readonly path: string; readonly suffix: string }
  /** `..` escaped the project root: the image must be dropped. */
  | { readonly kind: "escape" };

/** Directory of a workspace-relative file path ("" when at the root). */
function dirOf(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash === -1 ? "" : filePath.slice(0, slash);
}

/** Collapse . and .. segments; null when .. escapes the base. */
function normalizeRelPath(rel: string): string | null {
  const out: string[] = [];
  for (const part of rel.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

/** Percent-decode a path portion (best effort; never throws). */
function decodePathPart(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Resolve one markdown image src against the markdown file's location:
 * - Absolute URLs (http/https/data:/...) and fragment-only srcs are left to
 *   the browser ('absolute').
 * - Root-relative srcs (/img.png) resolve from the project root; other
 *   relative srcs resolve against the file's directory. `..` escaping the
 *   project root is rejected ('escape').
 * - The path portion is percent-decoded and any ?query#fragment suffix is
 *   preserved verbatim, so cache-busting srcs like ./img.png?v=2 still work.
 */
export function resolveWorkspaceMarkdownImage(filePath: string, src: string): WorkspaceMarkdownImageResolution {
  const trimmed = src.trim();
  if (trimmed === "" || trimmed.startsWith("#")) return { kind: "absolute" };
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return { kind: "absolute" };
  const q = trimmed.indexOf("?");
  const h = trimmed.indexOf("#");
  let cut = trimmed.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  const pathPart = decodePathPart(trimmed.slice(0, cut));
  const suffix = trimmed.slice(cut);
  const base = pathPart.startsWith("/") ? "" : dirOf(filePath);
  const joined = base === "" ? pathPart : `${base}/${pathPart}`;
  const normalized = normalizeRelPath(joined);
  if (normalized === null) return { kind: "escape" };
  return { kind: "relative", path: normalized, suffix };
}

/** Options controlling markdown rendering. */
export interface WorkspaceMarkdownRenderOptions {
  /**
   * Rewrite image srcs before they are emitted. Return the URL to use, or
   * null to drop the image (alt text only). Relative workspace paths are
   * typically resolved to absolute URLs here.
   */
  readonly resolveImageSrc?: (src: string) => string | null;
}

/**
 * Guard a raw link/image target against dangerous protocols. Returns the
 * (trimmed) raw string when safe, else null. Only these schemes are allowed:
 * http:, https:, mailto: and fragment anchors (#...). Scheme-less relative
 * paths (./ ../ / and plain filenames) pass through unchanged. Anything with
 * a scheme outside the allow-list — javascript:, data:, vbscript:, etc. —
 * is rejected so the value never reaches dangerouslySetInnerHTML.
 */
export function safeWorkspaceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("#")) return trimmed;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (scheme === null) return trimmed;
  const name = scheme[1].toLowerCase();
  return name === "http" || name === "https" || name === "mailto" ? trimmed : null;
}

/** Inline pass: code spans, bold, italic, strike, images, links. */
export function renderWorkspaceInline(text: string, options?: WorkspaceMarkdownRenderOptions): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const char = text[i]!;
    // Fenced inline code first.
    if (char === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        out += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }
    // Image ![alt](src)
    if (char === "!" && text[i + 1] === "[") {
      const close = text.indexOf("](", i + 2);
      if (close !== -1) {
        const parenEnd = text.indexOf(")", close + 2);
        if (parenEnd !== -1) {
          const alt = text.slice(i + 2, close);
          const src = text.slice(close + 2, parenEnd);
          const safe = safeWorkspaceUrl(src);
          if (safe === null) {
            out += escapeHtml(alt);
          } else {
            let target: string | null = safe;
            if (options?.resolveImageSrc !== undefined) {
              target = options.resolveImageSrc(safe);
            }
            if (target === null) {
              out += escapeHtml(alt);
            } else {
              const srcEsc = escapeHtml(target).replace(/\s+/g, "%20");
              out += `<img alt="${escapeHtml(alt)}" src="${srcEsc}" />`;
            }
          }
          i = parenEnd + 1;
          continue;
        }
      }
    }
    // Link [text](href)
    if (char === "[") {
      const close = text.indexOf("](", i + 1);
      if (close !== -1) {
        const parenEnd = text.indexOf(")", close + 2);
        if (parenEnd !== -1) {
          const label = text.slice(i + 1, close);
          const href = text.slice(close + 2, parenEnd);
          const safe = safeWorkspaceUrl(href);
          if (safe === null) {
            out += renderWorkspaceInline(label, options);
          } else {
            out += `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${renderWorkspaceInline(label, options)}</a>`;
          }
          i = parenEnd + 1;
          continue;
        }
      }
    }
    // Bold **text**
    if (char === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        out += `<strong>${renderWorkspaceInline(text.slice(i + 2, end), options)}</strong>`;
        i = end + 2;
        continue;
      }
    }
    // Italic *text*
    if (char === "*" && text[i - 1] !== "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end + 1] !== "*") {
        out += `<em>${renderWorkspaceInline(text.slice(i + 1, end), options)}</em>`;
        i = end + 1;
        continue;
      }
    }
    // Strikethrough ~~text~~
    if (char === "~" && text[i + 1] === "~") {
      const end = text.indexOf("~~", i + 2);
      if (end !== -1) {
        out += `<del>${renderWorkspaceInline(text.slice(i + 2, end), options)}</del>`;
        i = end + 2;
        continue;
      }
    }
    out += escapeHtml(char);
    i += 1;
  }
  return out;
}

/** Render a markdown document to HTML (block pass). */
export function renderWorkspaceMarkdown(source: string, options?: WorkspaceMarkdownRenderOptions): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const n = lines.length;

  const flushParagraph = (buffer: string[]): void => {
    if (buffer.length === 0) return;
    out.push(`<p>${renderWorkspaceInline(buffer.join("\n"), options)}</p>`);
    buffer.length = 0;
  };

  let paragraph: string[] = [];
  while (i < n) {
    const line = lines[i]!;

    // Fenced code block.
    const fence = /^```([\w+-]*)\s*$/.exec(line);
    if (fence !== null) {
      flushParagraph(paragraph);
      const lang = fence[1] ?? "";
      i += 1;
      const code: string[] = [];
      while (i < n && !/^```\s*$/.test(lines[i]!)) {
        code.push(lines[i]!);
        i += 1;
      }
      i += 1; // closing fence
      const escaped = escapeHtml(code.join("\n"));
      if (lang.toLowerCase() === "mermaid") {
        // Mermaid fence: emit the source as a data attribute so the enhancer
        // can re-render the diagram on shell theme flips (v0.6).
        out.push(`<pre class="language-mermaid" data-dsh-source="${escapeHtml(code.join("\n"))}"><code>${escaped}</code></pre>`);
      } else {
        const langAttr = lang === "" ? "" : ` class="language-${escapeHtml(lang)}"`;
        out.push(`<pre${langAttr}><code>${escaped}</code></pre>`);
      }
      continue;
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      flushParagraph(paragraph);
      const level = heading[1]!.length;
      out.push(`<h${level}>${renderWorkspaceInline(heading[2] ?? "", options)}</h${level}>`);
      i += 1;
      continue;
    }

    // Horizontal rule.
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph(paragraph);
      out.push("<hr />");
      i += 1;
      continue;
    }

    // Table: header row then separator row.
    if (line.includes("|") && i + 1 < n && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]!) && lines[i + 1]!.includes("-")) {
      flushParagraph(paragraph);
      const headerCells = splitWorkspaceTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < n && lines[i]!.includes("|")) {
        rows.push(splitWorkspaceTableRow(lines[i]!));
        i += 1;
      }
      out.push("<table>");
      out.push(`<thead><tr>${headerCells.map((cell) => `<th>${renderWorkspaceInline(cell, options)}</th>`).join("")}</tr></thead>`);
      if (rows.length > 0) {
        out.push(`<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderWorkspaceInline(cell, options)}</td>`).join("")}</tr>`).join("")}</tbody>`);
      }
      out.push("</table>");
      continue;
    }

    // Blockquote (one level).
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote !== null) {
      flushParagraph(paragraph);
      const body: string[] = [];
      while (i < n) {
        const q = /^>\s?(.*)$/.exec(lines[i]!);
        if (q === null) break;
        body.push(q[1] ?? "");
        i += 1;
      }
      out.push(`<blockquote><p>${body.map((item) => renderWorkspaceInline(item, options)).join("<br />")}</p></blockquote>`);
      continue;
    }

    // Unordered list.
    const ul = /^\s*([-*+])\s+(.*)$/.exec(line);
    if (ul !== null) {
      flushParagraph(paragraph);
      const items: string[] = [];
      while (i < n) {
        const item = /^\s*([-*+])\s+(.*)$/.exec(lines[i]!);
        if (item === null) break;
        items.push(`<li>${renderWorkspaceInline(item[2] ?? "", options)}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list.
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol !== null) {
      flushParagraph(paragraph);
      const items: string[] = [];
      while (i < n) {
        const item = /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]!);
        if (item === null) break;
        items.push(`<li>${renderWorkspaceInline(item[1] ?? "", options)}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Blank line: flush the paragraph.
    if (line.trim() === "") {
      flushParagraph(paragraph);
      i += 1;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }
  flushParagraph(paragraph);
  return out.join("\n");
}

/** Split one table row into cells (respecting the leading/trailing pipes). */
function splitWorkspaceTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}
