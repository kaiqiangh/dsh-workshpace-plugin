export type GitChangeStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked" | "typechange" | "unmerged";
export interface GitChange {
    readonly path: string;
    readonly previousPath?: string;
    readonly status: GitChangeStatus;
    /** True when the change is staged in the index; false for working-tree changes. */
    readonly staged: boolean;
}
export interface GitDiffResult {
    readonly path?: string;
    readonly staged: string;
    readonly unstaged: string;
    readonly truncated: boolean;
}
export type GitErrorCode = "GIT_UNAVAILABLE" | "NOT_A_GIT_REPOSITORY" | "PATH_OUTSIDE_WORKSPACE" | "GIT_TIMEOUT" | "GIT_OUTPUT_TOO_LARGE";
export declare class GitError extends Error {
    readonly code: GitErrorCode;
    constructor(code: GitErrorCode, message: string);
}
export declare const GIT_MAX_DIFF_BYTES: number;
/** Parse `git status --porcelain=v1 -z` output into typed, deduplicated changes. */
export declare function parsePorcelain(output: string): readonly GitChange[];
/** Current repository status (working-tree + staged), bounded and read-only. */
export declare function gitStatus(root: string): Promise<readonly GitChange[]>;
/** Unified diff for one path (or the whole tree): staged (`--cached`) and unstaged. */
export declare function gitDiff(root: string, pathInput?: string): Promise<GitDiffResult>;
/** Lazy repository check that fails closed with a typed error. */
export declare function isGitRepository(root: string): Promise<boolean>;
