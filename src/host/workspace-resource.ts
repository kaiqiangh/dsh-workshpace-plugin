import type { IncomingMessage, ServerResponse } from "node:http";

import { PreviewPanelError, PreviewService } from "../domain/preview.ts";

export interface WebRouteRegistrar {
  register(route: {
    readonly kind: "exact";
    readonly path: string;
    readonly handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
  }): () => void;
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

/** Register the public binary carrier; all authorization remains in PreviewService. */
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
      if (!resourceId || !mediaType || sessionId !== options.preview.identity.sessionId || rootId !== options.preview.identity.rootId) {
        noStore(response, 404);
        return;
      }
      try {
        const opened = await options.preview.openResource(resourceId, { identity: options.preview.identity, mediaType });
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
      }
    },
  });
}
