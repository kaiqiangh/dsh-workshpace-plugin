import type { IncomingMessage, ServerResponse } from "node:http";
import { PreviewService } from "../domain/preview.ts";
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
/**
 * Register the mermaid vendor bundle route: a fixed same-origin static asset
 * served with size+mtime ETag (dsh-web-ui serveVendorMermaid pattern). The
 * bundle ships inside the plugin package (lib/assets/mermaid.min.js, copied at
 * build time) so the browser never loads mermaid from a CDN — ADR 0011 keeps
 * the surface zero-runtime-dependency and privacy-bounded.
 */
export declare function registerWorkspaceVendorRoute(webServer: WebRouteRegistrar, options?: WorkspaceVendorRouteOptions): () => void;
/** Tie the vendor route to the owning Fiber. */
export declare function installWorkspaceVendorRoute(ctx: WorkspaceEffectRegistrar, webServer: WebRouteRegistrar, options?: WorkspaceVendorRouteOptions): void;
/** Register the opaque capability carrier; optional identity headers further bind a request when available. */
export declare function registerWorkspaceResourceRoute(webServer: WebRouteRegistrar, options: WorkspaceResourceRouteOptions): () => void;
/** Tie the route and its opaque resource table to the owning Fiber. */
export declare function installWorkspaceResourceRoute(ctx: WorkspaceEffectRegistrar, webServer: WebRouteRegistrar, options: WorkspaceResourceRouteOptions): void;
