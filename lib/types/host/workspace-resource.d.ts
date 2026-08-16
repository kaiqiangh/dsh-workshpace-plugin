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
/** Register the public binary carrier; all authorization remains in PreviewService. */
export declare function registerWorkspaceResourceRoute(webServer: WebRouteRegistrar, options: WorkspaceResourceRouteOptions): () => void;
/** Tie the route and its opaque resource table to the owning Fiber. */
export declare function installWorkspaceResourceRoute(ctx: WorkspaceEffectRegistrar, webServer: WebRouteRegistrar, options: WorkspaceResourceRouteOptions): void;
