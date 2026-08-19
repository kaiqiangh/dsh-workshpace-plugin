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
/** One parsed commit for the History surface (v0.7: list rows only, no graph lanes). */
export interface GitCommit {
    readonly sha: string;
    /** Parent SHAs (`%P`); carries the graph-ready shape for v0.8 lane computation. */
    readonly parents: readonly string[];
    readonly author: string;
    /** Author timestamp as Unix epoch seconds (`%at`). */
    readonly time: number;
    readonly subject: string;
    /** Short ref decorations from `%D` (e.g. "HEAD -> main, tag: v0.6"); "" when none. */
    readonly decorations: string;
}
export interface GitHistoryOptions {
    /** Max commits to return. Clamped to GIT_HISTORY_MAX_COMMITS. */
    readonly limit?: number;
    /** Skip this many commits for page-ahead pagination. */
    readonly offset?: number;
}
export interface GitCommitFile {
    readonly path: string;
    readonly additions: number;
    readonly deletions: number;
}
export interface GitCommitResult {
    readonly commit: GitCommit;
    readonly files: readonly GitCommitFile[];
    /** Bounded unified diff for the whole commit (256 KiB cap). */
    readonly diff: string;
    readonly diffTruncated: boolean;
}
export interface GitRepoInfo {
    readonly isGit: boolean;
    /** Active branch name (`--abbrev-ref HEAD`); "" when unborn/unavailable. */
    readonly branch: string;
    /** Short HEAD hash (`--short HEAD`); "" when unborn/unavailable. */
    readonly head: string;
    /** Commits ahead of the upstream branch; 0 when no upstream exists. */
    readonly ahead: number;
    /** Commits behind the upstream branch; 0 when no upstream exists. */
    readonly behind: number;
}
export type GitErrorCode = "GIT_UNAVAILABLE" | "NOT_A_GIT_REPOSITORY" | "PATH_OUTSIDE_WORKSPACE" | "GIT_TIMEOUT" | "GIT_OUTPUT_TOO_LARGE";
export declare class GitError extends Error {
    readonly code: GitErrorCode;
    constructor(code: GitErrorCode, message: string);
}
export declare const GIT_MAX_DIFF_BYTES: number;
/** Operational Budget: commit list pagination cap (research #122). */
export declare const GIT_HISTORY_MAX_COMMITS = 200;
/** Operational Budget: per-commit diff cap (half of GIT_MAX_DIFF_BYTES, research #122). */
export declare const GIT_COMMIT_MAX_DIFF_BYTES: number;
/** Parse `git status --porcelain=v1 -z` output into typed, deduplicated changes. */
export declare function parsePorcelain(output: string): readonly GitChange[];
/** Current repository status (working-tree + staged), bounded and read-only. */
export declare function gitStatus(root: string): Promise<readonly GitChange[]>;
/** Unified diff for one path (or the whole tree): staged (`--cached`) and unstaged. */
export declare function gitDiff(root: string, pathInput?: string): Promise<GitDiffResult>;
/** Lazy repository check that fails closed with a typed error. */
export declare function isGitRepository(root: string): Promise<boolean>;
/**
 * Commit list newest-first with author / time / subject / parents / branch
 * decoration. Delimiter-based (`%x1f` fields, `%x1e` records) so authors and
 * subjects with spaces parse cleanly; `parents` (`%P`) is captured now so the
 * data shape is forward-compatible with the v0.8 branch graph (research #122).
 */
export declare function gitHistory(root: string, options?: GitHistoryOptions): Promise<readonly GitCommit[]>;
/**
 * One commit: parsed metadata, `--numstat` file stats, and a bounded unified
 * diff (`git show --format=`). The diff is sliced to GIT_COMMIT_MAX_DIFF_BYTES
 * and flagged `diffTruncated` when the budget trips.
 */
export declare function gitCommit(root: string, sha: string): Promise<GitCommitResult>;
/**
 * HEAD + active branch + ahead/behind vs the upstream. Degrades to
 * `{ isGit: false }` outside a repository (never throws for non-git); a
 * missing upstream yields ahead=behind=0 rather than an error.
 */
export declare function gitRepoInfo(root: string): Promise<GitRepoInfo>;
