/**
 * Mermaid enhancement for rendered Workspace markdown previews (v0.6,
 * dsh-web-ui port). After the markdown renderer emits `pre.code.language-mermaid`
 * blocks, this module loads the same-origin vendor bundle
 * (`/workspace/vendor/mermaid.js`, shipped in the plugin package at build
 * time — zero runtime npm dependency, ADR 0011) and renders each block in
 * place. Renders that fail restore the block text so the diagram remains
 * readable as code. The theme follows the shell's `prefers-color-scheme`.
 */
/** The same-origin vendor route served by the host. */
export declare const MERMAID_VENDOR_URL = "/workspace/vendor/mermaid.js";
/** Operational Budget: max mermaid fences enhanced in one preview (ADR #113). */
export declare const MERMAID_MAX_BLOCKS = 16;
/** Current shell theme from `prefers-color-scheme` (defaults to light). */
export declare function shellIsDark(): boolean;
/** Observe shell theme flips; returns a disposer. */
export declare function watchShellTheme(listener: (isDark: boolean) => void): () => void;
/** The mermaid theme name for a shell theme. */
export declare function mermaidTheme(isDark: boolean): string;
/**
 * Render one mermaid code block in place. On success the `<pre>` is replaced
 * by the diagram SVG (carrying the source in `data-dsh-source` so a later
 * shell-theme flip can re-render it); on failure the block is restored so the
 * raw text stays readable. Returns true when the block rendered.
 */
export declare function renderMermaidBlock(block: HTMLPreElement, theme: string): Promise<boolean>;
/**
 * Enhance every mermaid fence inside one rendered markdown subtree. Returns
 * the number of blocks found (whether or not they rendered), so callers can
 * decide when to show the "diagram unavailable" fallback.
 */
export declare function enhanceMermaidBlocks(root: ParentNode, theme: string): Promise<number>;
/** Re-theme already-rendered diagrams (shell theme flip). */
export declare function rethemeMermaidBlocks(root: ParentNode, theme: string): Promise<void>;
