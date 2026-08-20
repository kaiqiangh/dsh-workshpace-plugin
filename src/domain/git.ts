import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizeWorkspacePath } from "./path.ts";

const execFileAsync = promisify(execFile);

export type GitChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "typechange"
  | "unmerged";

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
  /** `head` follows the current branch; `localBranches` includes local branch refs. */
  readonly scope?: GitHistoryScope;
}

export type GitHistoryScope = "head" | "localBranches";

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

export type GitErrorCode =
  | "GIT_UNAVAILABLE"
  | "NOT_A_GIT_REPOSITORY"
  | "PATH_OUTSIDE_WORKSPACE"
  | "GIT_TIMEOUT"
  | "GIT_OUTPUT_TOO_LARGE";

export class GitError extends Error {
  readonly code: GitErrorCode;

  constructor(code: GitErrorCode, message: string) {
    super(message);
    this.name = "GitError";
    this.code = code;
  }
}

export const GIT_MAX_DIFF_BYTES = 512 * 1024;
/** Operational Budget: commit list pagination cap (research #122). */
export const GIT_HISTORY_MAX_COMMITS = 200;
/** Operational Budget: per-commit diff cap (half of GIT_MAX_DIFF_BYTES, research #122). */
export const GIT_COMMIT_MAX_DIFF_BYTES = 256 * 1024;
const GIT_TIMEOUT_MS = 10_000;

function statusCode(status: string): GitChangeStatus {
  if (status.startsWith("?") || status === "??") return "untracked";
  if (status.startsWith("A")) return "added";
  if (status.startsWith("D")) return "deleted";
  if (status.startsWith("R")) return "renamed";
  if (status.startsWith("C")) return "copied";
  if (status.startsWith("U") || status.includes("U")) return "unmerged";
  if (status.startsWith("T")) return "typechange";
  return "modified";
}

function isGitError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: string }).code === "GIT_UNAVAILABLE";
}

/** Run git inside `root`, mapping process failures to typed GitError codes. */
async function runGit(root: string, args: readonly string[]): Promise<string> {
  let output: string;
  try {
    const { stdout } = await execFileAsync("git", [...args], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: GIT_MAX_DIFF_BYTES,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    output = stdout;
  } catch (error) {
    if (error instanceof Error && "killed" in error && (error as { killed?: boolean }).killed) throw new GitError("GIT_TIMEOUT", "git did not respond in time");
    if (error instanceof Error && (error as { code?: string }).code === "ENOENT") throw new GitError("GIT_UNAVAILABLE", "git is not available");
    const message = error instanceof Error ? error.message : String(error);
    if (/not a git repository/i.test(message)) throw new GitError("NOT_A_GIT_REPOSITORY", "Workspace Root is not a git repository");
    if (/maximum buffer size/i.test(message)) throw new GitError("GIT_OUTPUT_TOO_LARGE", "git output exceeded the safe limit");
    throw new GitError("GIT_UNAVAILABLE", message);
  }
  return output;
}

/** Parse `git status --porcelain=v1 -z` output into typed, deduplicated changes. */
export function parsePorcelain(output: string): readonly GitChange[] {
  const changes: GitChange[] = [];
  const fields = output.split("\0");
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field || field.length < 3) continue;
    const xy = field.slice(0, 2);
    let rawPath = field.slice(3);
    const indexStatus = xy[0];
    const worktreeStatus = xy[1];
    // With -z, a rename/copy emits its destination as the following field.
    if (indexStatus === "R" || indexStatus === "C") {
      const destination = fields[index + 1];
      if (destination) {
        const previous = normalizeWorkspacePath(rawPath);
        const current = normalizeWorkspacePath(destination);
        changes.push({ path: current, previousPath: previous, status: statusCode(xy), staged: true });
        index += 1;
        continue;
      }
    }
    const path = normalizeWorkspacePath(rawPath);
    if (!path) continue;
    changes.push({ path, status: statusCode(xy), staged: indexStatus !== "?" && indexStatus !== " " && worktreeStatus === " " });
  }
  return changes;
}

/** Current repository status (working-tree + staged), bounded and read-only. */
export async function gitStatus(root: string): Promise<readonly GitChange[]> {
  if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
  const output = await runGit(root, ["status", "--porcelain=v1", "-z"]);
  return parsePorcelain(output);
}

function assertDiffPath(pathInput: string | undefined): string | undefined {
  if (pathInput === undefined) return undefined;
  try {
    const path = normalizeWorkspacePath(pathInput);
    if (!path) throw new GitError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
    return path;
  } catch (error) {
    if (error instanceof GitError) throw error;
    throw new GitError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
  }
}

async function boundedDiff(root: string, args: readonly string[], maxBytes = GIT_MAX_DIFF_BYTES): Promise<{ readonly text: string; readonly truncated: boolean }> {
  let output = await runGit(root, args);
  let truncated = false;
  if (Buffer.byteLength(output, "utf8") > maxBytes) {
    output = output.slice(0, maxBytes);
    truncated = true;
  }
  return { text: output, truncated };
}

/** Unified diff for one path (or the whole tree): staged (`--cached`) and unstaged. */
export async function gitDiff(root: string, pathInput?: string): Promise<GitDiffResult> {
  if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
  const path = assertDiffPath(pathInput);
  const pathArgs = path === undefined ? [] : ["--", path];
  const [staged, unstaged] = await Promise.all([
    boundedDiff(root, ["diff", "--cached", ...pathArgs]),
    boundedDiff(root, ["diff", ...pathArgs]),
  ]);
  return Object.freeze({
    ...(path === undefined ? {} : { path }),
    staged: staged.text,
    unstaged: unstaged.text,
    truncated: staged.truncated || unstaged.truncated,
  });
}

/** Lazy repository check that fails closed with a typed error. */
export async function isGitRepository(root: string): Promise<boolean> {
  try {
    await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch (error) {
    if (isGitError(error) || (error instanceof GitError && error.code === "NOT_A_GIT_REPOSITORY")) return false;
    throw error;
  }
}

/** Record delimiter for git log --pretty output (research #122: no whitespace splitting). */
const GIT_LOG_RECORD = "\x1e";
/** Field delimiter inside one git log record. */
const GIT_LOG_FIELD = "\x1f";

/**
 * Commit list newest-first with author / time / subject / parents / branch
 * decoration. Delimiter-based (`%x1f` fields, `%x1e` records) so authors and
 * subjects with spaces parse cleanly; `parents` (`%P`) is captured now so the
 * data shape is forward-compatible with the v0.8 branch graph (research #122).
 */
export async function gitHistory(root: string, options: GitHistoryOptions = {}): Promise<readonly GitCommit[]> {
  if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? GIT_HISTORY_MAX_COMMITS), GIT_HISTORY_MAX_COMMITS));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const format = `%H${GIT_LOG_FIELD}%P${GIT_LOG_FIELD}%an${GIT_LOG_FIELD}%at${GIT_LOG_FIELD}%s${GIT_LOG_FIELD}%D${GIT_LOG_RECORD}`;
  const scopeArgs = options.scope === "localBranches" ? ["--branches", "--topo-order"] : ["--topo-order"];
  const output = await runGit(root, ["log", ...scopeArgs, "--max-count", String(limit), "--skip", String(offset), `--pretty=format:${format}`, "--decorate=short"]);
  const commits: GitCommit[] = [];
  for (const record of output.split(GIT_LOG_RECORD)) {
    const trimmed = record.trim();
    if (!trimmed) continue;
    const [sha, parents, author, time, subject, decorations] = trimmed.split(GIT_LOG_FIELD);
    if (!sha) continue;
    commits.push(Object.freeze({
      sha,
      parents: Object.freeze(parents ? parents.split(" ") : []),
      author: author ?? "",
      time: Number(time) || 0,
      subject: subject ?? "",
      decorations: decorations ?? "",
    }));
  }
  return Object.freeze(commits);
}

/**
 * One commit: parsed metadata, `--numstat` file stats, and a bounded unified
 * diff (`git show --format=`). The diff is sliced to GIT_COMMIT_MAX_DIFF_BYTES
 * and flagged `diffTruncated` when the budget trips.
 */
export async function gitCommit(root: string, sha: string): Promise<GitCommitResult> {
  if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
  if (typeof sha !== "string" || !sha.trim()) throw new GitError("GIT_UNAVAILABLE", "Commit is unavailable");
  const format = `%H${GIT_LOG_FIELD}%P${GIT_LOG_FIELD}%an${GIT_LOG_FIELD}%at${GIT_LOG_FIELD}%s${GIT_LOG_FIELD}%D`;
  const meta = await runGit(root, ["log", "-1", `--pretty=format:${format}`, "--decorate=short", sha]);
  const [full, parents, author, time, subject, decorations] = meta.trim().split(GIT_LOG_FIELD);
  if (!full) throw new GitError("GIT_UNAVAILABLE", "Commit is unavailable");
  const files: GitCommitFile[] = [];
  const stats = await runGit(root, ["diff-tree", "--root", "--no-commit-id", "--numstat", "-r", sha]);
  for (const line of stats.split("\n")) {
    if (!line.trim()) continue;
    const [additions, deletions, ...rest] = line.split("\t");
    const path = rest.join("\t");
    if (!path) continue;
    const additionsCount = additions && additions !== "-" ? Number(additions) : 0;
    const deletionsCount = deletions && deletions !== "-" ? Number(deletions) : 0;
    files.push(Object.freeze({
      path,
      additions: Number.isFinite(additionsCount) ? additionsCount : 0,
      deletions: Number.isFinite(deletionsCount) ? deletionsCount : 0,
    }));
  }
  const { text, truncated } = await boundedDiff(root, ["show", "--format=", sha], GIT_COMMIT_MAX_DIFF_BYTES);
  return Object.freeze({
    commit: Object.freeze({
      sha: full,
      parents: Object.freeze(parents ? parents.split(" ") : []),
      author: author ?? "",
      time: Number(time) || 0,
      subject: subject ?? "",
      decorations: decorations ?? "",
    }),
    files: Object.freeze(files),
    diff: text,
    diffTruncated: truncated,
  });
}

/**
 * HEAD + active branch + ahead/behind vs the upstream. Degrades to
 * `{ isGit: false }` outside a repository (never throws for non-git); a
 * missing upstream yields ahead=behind=0 rather than an error.
 */
export async function gitRepoInfo(root: string): Promise<GitRepoInfo> {
  if (typeof root !== "string" || !root.trim()) throw new GitError("GIT_UNAVAILABLE", "Workspace Root is unavailable");
  let inTree: string;
  try {
    inTree = (await runGit(root, ["rev-parse", "--is-inside-work-tree"])).trim();
  } catch (error) {
    if (error instanceof GitError && error.code === "NOT_A_GIT_REPOSITORY") return Object.freeze({ isGit: false, branch: "", head: "", ahead: 0, behind: 0 });
    throw error;
  }
  if (inTree !== "true") return Object.freeze({ isGit: false, branch: "", head: "", ahead: 0, behind: 0 });
  let branch = "";
  try { branch = (await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"])).trim(); } catch { branch = ""; }
  let head = "";
  try { head = (await runGit(root, ["rev-parse", "--short", "HEAD"])).trim(); } catch { head = ""; }
  let ahead = 0;
  let behind = 0;
  try {
    const counts = (await runGit(root, ["rev-list", "--left-right", "--count", "HEAD...@{u}"])).trim();
    const [left, right] = counts.split(/\s+/u);
    ahead = Number(left) || 0;
    behind = Number(right) || 0;
  } catch {
    ahead = 0;
    behind = 0;
  }
  return Object.freeze({ isGit: true, branch, head, ahead, behind });
}
