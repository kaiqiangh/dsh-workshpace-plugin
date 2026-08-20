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
export declare function escapeHtml(text: string): string;
/** How one image src resolves against the markdown file's location. */
export type WorkspaceMarkdownImageResolution = 
/** Scheme URL or fragment: the browser resolves it as-is. */
{
    readonly kind: "absolute";
}
/** Workspace-relative target: resolved path plus any ?query#fragment suffix. */
 | {
    readonly kind: "relative";
    readonly path: string;
    readonly suffix: string;
}
/** `..` escaped the project root: the image must be dropped. */
 | {
    readonly kind: "escape";
};
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
export declare function resolveWorkspaceMarkdownImage(filePath: string, src: string): WorkspaceMarkdownImageResolution;
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
export declare function safeWorkspaceUrl(raw: string): string | null;
/** Inline pass: code spans, bold, italic, strike, images, links. */
export declare function renderWorkspaceInline(text: string, options?: WorkspaceMarkdownRenderOptions): string;
/** Render a markdown document to HTML (block pass). */
export declare function renderWorkspaceMarkdown(source: string, options?: WorkspaceMarkdownRenderOptions): string;
