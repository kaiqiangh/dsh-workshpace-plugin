import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitRepoInfo } from "../domain/git.ts";
import { type WorkspaceHistoryRemote } from "./workspace-history-surface.ts";
import { type WorkspaceChangesRemote } from "./workspace-changes-surface.ts";
/** Reserved for shared host-rendering primitives; v0.7 renders the Changes pane and History pane in the tab. */
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
    /**
     * Reserved: carrier width in px for the Changes split-view breakpoint of the
     * standalone Changes surface (the Git tab's compact pane is always unified).
     */
    readonly carrierWidth?: number;
    /** Reserved: which carrier the standalone Changes surface lives in. */
    readonly carrier?: string;
}
/**
 * The single Git tab (prototype #124): repo status header + a Changes/History
 * segmented switch. The Changes pane renders filter chips, grouped file rows
 * (status letter + path + `+N -M`), and a unified diff. The History pane embeds
 * the commit-history surface. A non-Git workspace renders one centered empty
 * state (no spinner, no error).
 */
export declare function createWorkspaceGitSurfaceComponent(remote: WorkspaceGitRemote | undefined, primitives?: WorkspaceGitPrimitives, options?: WorkspaceGitSurfaceOptions): (props: Record<string, unknown>) => ReactNode;
