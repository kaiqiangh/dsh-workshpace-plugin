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

async function boundedDiff(root: string, args: readonly string[]): Promise<{ readonly text: string; readonly truncated: boolean }> {
  let output = await runGit(root, args);
  let truncated = false;
  if (Buffer.byteLength(output, "utf8") > GIT_MAX_DIFF_BYTES) {
    output = output.slice(0, GIT_MAX_DIFF_BYTES);
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
