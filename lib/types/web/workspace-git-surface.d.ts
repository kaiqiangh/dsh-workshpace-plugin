import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitRepoInfo } from "../domain/git.ts";
import { type WorkspaceChangesRemote } from "./workspace-changes-surface.ts";
import { type WorkspaceHistoryRemote } from "./workspace-history-surface.ts";
/** Reserved for shared host-rendering primitives; v0.7 embeds the existing Changes surface and the diff parser directly. */
export interface WorkspaceGitPrimitives {
}
export interface WorkspaceGitRemote extends WorkspaceChangesRemote, WorkspaceHistoryRemote {
    readonly gitRepoInfo: () => Promise<RemoteResult<GitRepoInfo>>;
}
export interface WorkspaceGitSurfaceOptions {
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceGitRemote | undefined;
    readonly remote?: WorkspaceGitRemote;
    /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
    readonly refreshMs?: number;
    /** Carrier width in px for the embedded Changes split-view breakpoint; tests inject it. */
    readonly carrierWidth?: number;
    /** Which carrier the embedded Changes surface lives in (split-view preference memory). */
    readonly carrier?: string;
}
/**
 * The single Git tab (IA #125): repo status header + an internal
 * Changes/History segmented switch. The Changes pane embeds the existing
 * changes surface; the History pane embeds the commit-history surface. A
 * non-Git workspace renders one centered empty state (no spinner, no error).
 */
export declare function createWorkspaceGitSurfaceComponent(remote: WorkspaceGitRemote | undefined, primitives?: WorkspaceGitPrimitives, options?: WorkspaceGitSurfaceOptions): (props: Record<string, unknown>) => ReactNode;
