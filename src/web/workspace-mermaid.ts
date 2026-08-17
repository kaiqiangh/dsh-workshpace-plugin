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
export const MERMAID_VENDOR_URL = "/workspace/vendor/mermaid.js";

/** Operational Budget: max mermaid fences enhanced in one preview (ADR #113). */
export const MERMAID_MAX_BLOCKS = 16;

/** The markdown renderer emits mermaid fences as `pre.code.language-mermaid`. */
const MERMAID_BLOCK_SELECTOR = "pre code.language-mermaid";

/** Current shell theme from `prefers-color-scheme` (defaults to light). */
export function shellIsDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Observe shell theme flips; returns a disposer. */
export function watchShellTheme(listener: (isDark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  try {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => listener(event.matches);
    if (typeof query.addEventListener === "function") query.addEventListener("change", onChange);
    else if (typeof query.addListener === "function") (query as { addListener: (fn: (event: MediaQueryListEvent) => void) => void }).addListener(onChange);
    return () => {
      if (typeof query.removeEventListener === "function") query.removeEventListener("change", onChange);
      else if (typeof query.removeListener === "function") (query as { removeListener: (fn: (event: MediaQueryListEvent) => void) => void }).removeListener(onChange);
    };
  } catch {
    return () => {};
  }
}

/** The mermaid theme name for a shell theme. */
export function mermaidTheme(isDark: boolean): string {
  return isDark ? "dark" : "default";
}

/** Resolve the mermaid API from the vendor bundle (window.mermaid). */
function mermaidApi(): { readonly initialize: (config: Record<string, unknown>) => void; readonly render: (id: string, source: string) => Promise<{ readonly svg: string }> } | undefined {
  const api = (globalThis as { readonly mermaid?: { readonly initialize: (config: Record<string, unknown>) => void; readonly render: (id: string, source: string) => Promise<{ readonly svg: string }> } }).mermaid;
  return api;
}

/** Load the vendor bundle once; resolves when mermaid is available. */
let vendorPromise: Promise<boolean> | undefined;
function loadVendor(): Promise<boolean> {
  if (mermaidApi()) return Promise.resolve(true);
  if (vendorPromise) return vendorPromise;
  vendorPromise = new Promise<boolean>((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }
    const script = document.createElement("script");
    script.src = MERMAID_VENDOR_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(mermaidApi()));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return vendorPromise;
}

/** Initialize mermaid once with the current theme (idempotent per theme). */
let initializedFor: string | undefined;
function ensureInitialized(theme: string): void {
  if (initializedFor === theme) return;
  const api = mermaidApi();
  if (!api) return;
  api.initialize({ startOnLoad: false, theme, securityLevel: "strict", suppressErrorRendering: true });
  initializedFor = theme;
}

/**
 * Render one mermaid code block in place. On success the `<pre>` is replaced
 * by the diagram SVG (carrying the source in `data-dsh-source` so a later
 * shell-theme flip can re-render it); on failure the block is restored so the
 * raw text stays readable. Returns true when the block rendered.
 */
export async function renderMermaidBlock(block: HTMLPreElement, theme: string): Promise<boolean> {
  const code = block.querySelector("code");
  if (!code) return false;
  const source = code.textContent ?? "";
  if (!source.trim()) return false;
  const api = mermaidApi();
  if (!api) return false;
  ensureInitialized(theme);
  const id = `dsh-mermaid-${Math.random().toString(36).slice(2)}`;
  try {
    const { svg } = await api.render(id, source);
    const container = document.createElement("div");
    container.className = "dsh-workspace-mermaid";
    container.setAttribute("data-dsh-source", source);
    container.innerHTML = svg;
    block.replaceWith(container);
    return true;
  } catch {
    // Restore readable code: the block was never replaced on failure.
    return false;
  }
}

/**
 * Enhance every mermaid fence inside one rendered markdown subtree. Returns
 * the number of blocks found (whether or not they rendered), so callers can
 * decide when to show the "diagram unavailable" fallback.
 */
export async function enhanceMermaidBlocks(root: ParentNode, theme: string): Promise<number> {
  const blocks = Array.from(root.querySelectorAll(MERMAID_BLOCK_SELECTOR)).map((code) => code.closest("pre")).slice(0, MERMAID_MAX_BLOCKS);
  if (blocks.length === 0) return 0;
  const loaded = await loadVendor();
  if (!loaded) return blocks.length;
  await Promise.all(blocks.map((block) => block ? renderMermaidBlock(block, theme) : Promise.resolve(false)));
  return blocks.length;
}

/** Re-theme already-rendered diagrams (shell theme flip). */
export async function rethemeMermaidBlocks(root: ParentNode, theme: string): Promise<void> {
  const diagrams = Array.from(root.querySelectorAll<HTMLElement>(".dsh-workspace-mermaid"));
  if (diagrams.length === 0) return;
  const api = mermaidApi();
  if (!api) return;
  ensureInitialized(theme);
  for (const diagram of diagrams) {
    const source = diagram.getAttribute("data-dsh-source");
    if (!source) continue;
    try {
      const id = `dsh-mermaid-${Math.random().toString(36).slice(2)}`;
      const { svg } = await api.render(id, source);
      const next = document.createElement("div");
      next.className = "dsh-workspace-mermaid";
      next.setAttribute("data-dsh-source", source);
      next.innerHTML = svg;
      diagram.replaceWith(next);
    } catch {
      // Keep the current diagram on re-theme failure.
    }
  }
}
