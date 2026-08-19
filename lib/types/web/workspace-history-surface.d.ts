import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitCommit, GitCommitResult, GitHistoryOptions } from "../domain/git.ts";
export interface WorkspaceHistoryRemote {
    readonly gitHistory: (options?: GitHistoryOptions) => Promise<RemoteResult<readonly GitCommit[]>>;
    readonly gitCommit: (sha: string) => Promise<RemoteResult<GitCommitResult>>;
}
export interface WorkspaceHistorySurfaceOptions {
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceHistoryRemote | undefined;
    readonly remote?: WorkspaceHistoryRemote;
    /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
    readonly refreshMs?: number;
}
/** Split one combined `git show` diff into per-file sections at `diff --git` boundaries. */
export declare function splitDiffByFile(diff: string): readonly string[];
/** New-path side of a `diff --git a/old b/new` header (quotes stripped). */
export declare function diffHeaderPath(line: string): string | undefined;
/**
 * Read-only commit history: commit list (left) + selected-commit summary and
 * per-file unified diff (right). The list reserves a placeholder strip at its
 * top for the v0.8 branch graph; v0.7 renders plain commit rows only.
 */
export declare function createWorkspaceHistorySurfaceComponent(remote: WorkspaceHistoryRemote | undefined, options?: WorkspaceHistorySurfaceOptions): (props: Record<string, unknown>) => ReactNode;
