import type { IncomingMessage, ServerResponse } from "node:http";

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
        const headers: Record<string, string | number> = {
          "cache-control": "no-store",
          "content-type": opened.mediaType,
          "content-length": opened.bytes.byteLength,
          "x-content-type-options": "nosniff",
        };
        if (url.searchParams.get("download") === "1") {
          headers["content-disposition"] = `attachment; filename="${opened.downloadName.replace(/["\\\r\n]/gu, "_")}"`;
        }
        response.writeHead(200, headers);
        response.end(Buffer.from(opened.bytes));
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
