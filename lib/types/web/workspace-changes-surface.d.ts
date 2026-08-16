import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitDiffResult, GitErrorCode } from "../domain/git.ts";
export interface WorkspaceChangesRemote {
    readonly gitStatus: () => Promise<RemoteResult<readonly GitChange[]>>;
    readonly gitDiff: (path?: string) => Promise<RemoteResult<GitDiffResult>>;
}
export interface WorkspaceChangesSurfaceOptions {
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceChangesRemote | undefined;
    readonly remote?: WorkspaceChangesRemote;
}
/** Read-only Changes view: git status list + unified diff preview. */
export declare function createWorkspaceChangesSurfaceComponent(remote: WorkspaceChangesRemote | undefined, options?: WorkspaceChangesSurfaceOptions): (props: Record<string, unknown>) => ReactNode;
export type { GitErrorCode };
