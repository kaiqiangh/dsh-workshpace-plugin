import type { IncomingMessage, ServerResponse } from "node:http";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PreviewPanelError, PreviewService } from "../domain/preview.ts";

export interface WebRouteRegistrar {
  register(route: {
    readonly kind: "exact";
    readonly path: string;
    readonly handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
  }): () => void;
}

export interface WorkspaceEffectRegistrar {
  effect(factory: () => void | (() => void), label?: string): void;
}

export interface WorkspaceResourceRouteOptions {
  readonly preview: PreviewService;
  readonly path?: string;
}

export interface WorkspaceVendorRouteOptions {
  /** Fixed same-origin static route for the mermaid vendor bundle. */
  readonly path?: string;
}

const VENDOR_PATH = "/workspace/vendor/mermaid.js";

/**
 * Register the mermaid vendor bundle route: a fixed same-origin static asset
 * served with size+mtime ETag (dsh-web-ui serveVendorMermaid pattern). The
 * bundle ships inside the plugin package (lib/assets/mermaid.min.js, copied at
 * build time) so the browser never loads mermaid from a CDN — ADR 0011 keeps
 * the surface zero-runtime-dependency and privacy-bounded.
 */
export function registerWorkspaceVendorRoute(
  webServer: WebRouteRegistrar,
  options: WorkspaceVendorRouteOptions = {},
): () => void {
  if (!webServer?.register) throw new Error("Workspace vendor route requires the public WebServer");
  const path = options.path ?? VENDOR_PATH;
  if (!/^\/[A-Za-z0-9._/-]+$/u.test(path) || path.endsWith("/")) throw new Error("Workspace vendor route path is invalid");
  let cached: { readonly data: Buffer; readonly etag: string } | undefined;
  return webServer.register({
    kind: "exact",
    path,
    handler: async (_request, response) => {
      try {
        if (!cached) {
          // Candidate layouts: the built lib half (lib/index.js -> lib/assets)
          // and the source tree (src/host/workspace-resource.ts -> lib/assets).
          const candidates = ["./assets/mermaid.min.js", "../../lib/assets/mermaid.min.js"];
          let assetPath: string | undefined;
          let info: Awaited<ReturnType<typeof stat>> | undefined;
          for (const relative of candidates) {
            try {
              const candidate = fileURLToPath(new URL(relative, import.meta.url));
              info = await stat(candidate);
              assetPath = candidate;
              break;
            } catch {
              // try the next layout
            }
          }
          if (!assetPath || !info) throw new Error("mermaid vendor asset missing");
          const { readFile } = await import("node:fs/promises");
          const data = await readFile(assetPath);
          cached = { data, etag: `"${data.length}-${info.mtimeMs.toString(16)}"` };
        }
        response.writeHead(200, {
          "content-type": "application/javascript; charset=utf-8",
          "content-length": cached.data.length,
          "cache-control": "no-cache",
          etag: cached.etag,
          "x-content-type-options": "nosniff",
        });
        response.end(cached.data);
      } catch {
        response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "mermaid vendor asset missing" }));
      }
    },
  });
}

/** Tie the vendor route to the owning Fiber. */
export function installWorkspaceVendorRoute(
  ctx: WorkspaceEffectRegistrar,
  webServer: WebRouteRegistrar,
  options: WorkspaceVendorRouteOptions = {},
): void {
  if (!ctx?.effect) throw new Error("Workspace vendor route requires a Fiber effect registrar");
  ctx.effect(() => {
    return registerWorkspaceVendorRoute(webServer, options);
  }, "workspace vendor route");
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.length === 1 ? value[0] : undefined : value;
}

function statusFor(error: unknown): number {
  if (!(error instanceof PreviewPanelError)) return 404;
  if (error.code === "RESOURCE_EXPIRED" || error.code === "RESOURCE_STALE") return 410;
  if (error.code === "FILE_TOO_LARGE") return 413;
  return 404;
}

function noStore(response: ServerResponse, status: number): void {
  response.writeHead(status, { "cache-control": "no-store", "content-length": "0" });
  response.end();
}

/** Strip the weak prefix and quotes so entity-tags compare by opaque value. */
function normalizeEtag(value: string): string {
  return value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}

/** Whether an If-None-Match header matches the current etag (weak compare). */
function ifNoneMatchSaidFresh(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false;
  const current = normalizeEtag(etag);
  return header.split(",").some((candidate) => {
    const tag = candidate.trim();
    return tag === "*" || normalizeEtag(tag) === current;
  });
}

/**
 * Parse a `Range: bytes=start-end` header against the total size. Returns
 * `{start,end}` for a satisfiable single range, 'invalid' for a syntactically
 * valid range that cannot be satisfied, or null when the header is absent or
 * unsupported (RFC 7233: a server may ignore any Range it does not support).
 */
function parseByteRange(header: string | undefined, size: number): { readonly start: number; readonly end: number } | "invalid" | null {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null || (match[1] === "" && match[2] === "")) return null;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix <= 0 || size === 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (size === 0 || start > end || start >= size) return "invalid";
  return { start, end };
}

/** Register the opaque capability carrier; optional identity headers further bind a request when available. */
export function registerWorkspaceResourceRoute(
  webServer: WebRouteRegistrar,
  options: WorkspaceResourceRouteOptions,
): () => void {
  if (!webServer?.register || !options?.preview) throw new Error("Workspace resource route requires the public WebServer and PreviewService");
  const path = options.path ?? "/workspace/resource";
  if (!/^\/[A-Za-z0-9._/-]+$/u.test(path) || path.endsWith("/")) throw new Error("Workspace resource route path is invalid");
  return webServer.register({
    kind: "exact",
    path,
    handler: async (request, response) => {
      const url = new URL(request.url ?? "/", "http://workspace.local");
      const resourceId = url.searchParams.get("id");
      const mediaType = url.searchParams.get("type");
      const sessionId = headerValue(request.headers["x-dsh-session"]);
      const rootId = headerValue(request.headers["x-dsh-root"]);
      if (!resourceId || !mediaType || (sessionId !== undefined && sessionId !== options.preview.identity.sessionId) || (rootId !== undefined && rootId !== options.preview.identity.rootId)) {
        noStore(response, 404);
        return;
      }
      const controller = new AbortController();
      const abort = () => { if (!response.writableEnded) controller.abort(); };
      if (typeof request.once === "function") {
        request.once("aborted", abort);
      }
      response.once?.("close", abort);
      try {
        const opened = await options.preview.openResource(resourceId, { identity: options.preview.identity, mediaType, signal: controller.signal });
        // PDF streaming (v0.6, dsh-web-ui port): ETag from the resource
        // version + no-cache so the browser pdf viewer revalidates cheaply;
        // single byte ranges answer 206/416 so large PDFs can seek.
        const etag = `"${opened.version}"`;
        const baseHeaders: Record<string, string | number> = {
          "cache-control": "no-cache",
          "content-type": opened.mediaType,
          "x-content-type-options": "nosniff",
          etag,
          "accept-ranges": "bytes",
        };
        if (ifNoneMatchSaidFresh(request.headers["if-none-match"], etag) && request.headers.range === undefined) {
          response.writeHead(304, baseHeaders);
          response.end();
          return;
        }
        const bytes = opened.bytes;
        const total = bytes.byteLength;
        const range = parseByteRange(request.headers.range, total);
        if (range === "invalid") {
          response.writeHead(416, { ...baseHeaders, "content-range": `bytes */${total}` });
          response.end();
          return;
        }
        if (url.searchParams.get("download") === "1") {
          baseHeaders["content-disposition"] = `attachment; filename="${opened.downloadName.replace(/["\\\r\n]/gu, "_")}"`;
        }
        if (range === null) {
          baseHeaders["content-length"] = total;
          response.writeHead(200, baseHeaders);
          response.end(Buffer.from(bytes));
        } else {
          baseHeaders["content-range"] = `bytes ${range.start}-${range.end}/${total}`;
          baseHeaders["content-length"] = range.end - range.start + 1;
          response.writeHead(206, baseHeaders);
          response.end(Buffer.from(bytes.subarray(range.start, range.end + 1)));
        }
      } catch (error) {
        noStore(response, statusFor(error));
      } finally {
        request.off?.("aborted", abort);
        response.off?.("close", abort);
      }
    },
  });
}

/** Tie the route and its opaque resource table to the owning Fiber. */
export function installWorkspaceResourceRoute(
  ctx: WorkspaceEffectRegistrar,
  webServer: WebRouteRegistrar,
  options: WorkspaceResourceRouteOptions,
): void {
  if (!ctx?.effect) throw new Error("Workspace resource route requires a Fiber effect registrar");
  ctx.effect(() => {
    const disposeRoute = registerWorkspaceResourceRoute(webServer, options);
    return () => {
      disposeRoute();
      options.preview.dispose();
    };
  }, "workspace opaque resource route");
}
