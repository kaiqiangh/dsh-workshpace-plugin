import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitDiffResult } from "../domain/git.ts";
export interface WorkspaceChangesRemote {
    readonly gitStatus: () => Promise<RemoteResult<readonly GitChange[]>>;
    readonly gitDiff: (path?: string) => Promise<RemoteResult<GitDiffResult>>;
}
export interface WorkspaceChangesSurfaceOptions {
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceChangesRemote | undefined;
    readonly remote?: WorkspaceChangesRemote;
    /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
    readonly refreshMs?: number;
    /** Carrier width in px for the split-view breakpoint; tests inject it (browser uses ResizeObserver). */
    readonly carrierWidth?: number;
    /** Which carrier this surface lives in; the unified/split preference is remembered per carrier. */
    readonly carrier?: string;
}
type ChangeFilter = "all" | "added" | "modified" | "deleted" | "untracked" | "staged";
/** Split view appears only on carriers at least this wide (VS Code-style auto-degradation). */
export declare const SPLIT_BREAKPOINT = 900;
declare function matchesFilter(change: GitChange, filter: ChangeFilter): boolean;
/** Read-only Changes view: git status list + readable unified diff preview. */
export declare function createWorkspaceChangesSurfaceComponent(remote: WorkspaceChangesRemote | undefined, options?: WorkspaceChangesSurfaceOptions): (props: Record<string, unknown>) => ReactNode;
export type { GitDiffResult };
export type { ChangeFilter };
export { matchesFilter };
