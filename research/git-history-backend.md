# Research: Git History Backend — DSH Seam vs. Shelling to `git log`

**Ticket:** #122 (R4 in the #117 frontier)
**Map parent:** #117 — Workspace v0.7
**Branch:** `research/git-history-backend` (markdown findings only; no `src/` or `lib/` changes)
**Status:** Resolved — decision: **shell to `git`** (no reusable DSH seam exists)

---

## 1. Decision

**Shell to `git`.** No SCM/history seam exists in any DSH package.

### Investigation method

Grepped every `@deepseek-ai/*` package (`.d.ts` and `.js`) for the named seams and for actual git invocations:

- `scm.history`, `git.log`, `git.revList`, `gitHistory`, `repository.history`, `commit.list`
- `rev-parse`, `rev-list`, `--numstat`, `--porcelain`, `git log`, `spawn("git")`, `execFile("git")`

Targeted the three packages named in the ticket:

- `@deepseek-ai/dsh-tools/lib/types/index.d.ts`
- `@deepseek-ai/dsh-session/lib/types/index.d.ts`
- `@deepseek-ai/cordis/lib/types/index.d.ts`

### Findings

- **No matches** for any `scm.*`/`git.*` seam or for any `git` subprocess invocation across all DSH packages.
- The only `commit` / `history` / `branch` symbols found are unrelated to VCS:
  - `dsh-tools` — "commit-style observers" and "commit the successful result batch" (agent-loop / message-commit semantics, not git).
  - `dsh-session` — "LLM message history", "derived history" (conversation log, not git).
  - `cordis` — plugin-service framework; no git surface at all.
- The host's existing Git module (`src/domain/git.ts`) already shells to `git` via `runGit(root, args)` and `parsePorcelain`. The History surface should follow the **exact same pattern**.

**Conclusion:** reuse `runGit` + a typed parser. No new dependency, no DSH seam to consume.

---

## 2. Contract

All functions live in `src/domain/git.ts`, exported through `src/index.ts` with `@Remote(...)`, mirrored in `src/client.ts`, and surfaced in `src/web/workspace-changes-surface.ts` (or a new `workspace-history-surface.ts`). Types re-exported from `src/types.ts`. This matches the existing `gitStatus` / `gitDiff` contract exactly.

### Types

```ts
import type { GitChangeStatus } from "./git.ts";

export interface GitCommit {
  readonly sha: string;                 // full 40-char
  readonly shortSha: string;            // --short (7-char)
  readonly author: string;
  readonly email: string;
  readonly date: string;                // ISO 8601 (--date=iso-strict)
  readonly relativeTime: string;        // --date=relative
  readonly subject: string;
  readonly body?: string;
  readonly parents: readonly string[];  // %P — enables v0.8 graph, costs nothing now
  readonly refs?: readonly string[];    // branch/tag decorations (--decorate=short)
}

export interface GitCommitFile {
  readonly path: string;
  readonly status: GitChangeStatus;     // reuses existing GitChangeStatus
  readonly insertions: number;          // from --numstat
  readonly deletions: number;
}

export interface GitCommitDetail extends GitCommit {
  readonly files: readonly GitCommitFile[];
  readonly diff: string;                // git show <sha>, bounded
  readonly diffTruncated: boolean;
}

export interface GitRepoInfo {
  readonly headSha: string;
  readonly headShort: string;
  readonly branch: string;              // active branch name
  readonly upstream?: string;           // e.g. "origin/main"
  readonly ahead: number;
  readonly behind: number;
}
```

### Functions

```ts
export interface GitHistoryOptions {
  /** Max commits to return. Clamped to GIT_HISTORY_MAX_COMMITS. */
  readonly limit?: number;
  /** Skip this many commits for page-ahead pagination. */
  readonly offset?: number;
  /** Restrict history to a single path (optional). */
  readonly path?: string;
}

/** Commit list with author / relative time / branch decoration. */
export async function gitHistory(root: string, options?: GitHistoryOptions): Promise<readonly GitCommit[]>;

/** Per-commit file stats + bounded unified diff. */
export async function gitCommit(root: string, sha: string): Promise<GitCommitDetail>;

/** HEAD + active branch + ahead/behind vs upstream. */
export async function gitRepoInfo(root: string): Promise<GitRepoInfo>;
```

### `git` invocations that back the contract

| Need | Invocation |
| --- | --- |
| Commit list | `git log --pretty=format:'%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%ar%x1f%s%x1f%b%x1f%P%x1f%d' --date=iso-strict --decorate=short -z --max-count=<limit> --skip=<offset> [-- <path>]` |
| HEAD short | `git rev-parse --short HEAD` |
| Active branch | `git rev-parse --abbrev-ref HEAD` |
| Ahead/behind | `git rev-list --left-right --count HEAD...@{u}` (guard: no upstream → 0/0) |
| Per-commit files | `git show --format= -z --numstat --name-status <sha>` |
| Per-commit diff | `git show <sha>` |

**Parser note:** mirror `parsePorcelain` — use `-z` and explicit `%x1f` (field) / `%x1e` (record) delimiters so author names, subjects, and bodies with newlines/spaces parse cleanly and unambiguously. Do not rely on whitespace splitting.

---

## 3. Budget

Consistent with `GIT_MAX_DIFF_BYTES = 512 KiB` and `GIT_TIMEOUT_MS = 10_000` (already defined in `src/domain/git.ts`):

| Parameter | Value | Rationale |
| --- | --- | --- |
| `GIT_HISTORY_MAX_COMMITS` | **200** | Page-ahead pagination via `offset` if the UI needs more. One `git log` call stays well under timeout. |
| `GIT_COMMIT_MAX_DIFF_BYTES` | **256 KiB** (256 × 1024) | Half of `GIT_MAX_DIFF_BYTES`. A History view renders many commits; halving per-commit keeps aggregate memory bounded and leaves headroom for the parallel `gitStatus`/`gitDiff` surfaces. |
| `GIT_TIMEOUT_MS` | **10_000** (reuse) | Mirror existing `runGit` timeout. No new constant needed. |
| `maxBuffer` | `GIT_MAX_DIFF_BYTES` | Reuse `runGit`'s `maxBuffer`; per-commit diffs are further sliced to `GIT_COMMIT_MAX_DIFF_BYTES` and flagged `diffTruncated`. |
| Output-too-large | reuse `GIT_OUTPUT_TOO_LARGE` | Name and handling already exist in `runGit`. |

Errors reuse the existing `GitError` codes (`GIT_UNAVAILABLE`, `NOT_A_GIT_REPOSITORY`, `GIT_TIMEOUT`, `GIT_OUTPUT_TOO_LARGE`). Ahead/behind without an upstream degrades gracefully to `ahead=behind=0` rather than throwing.

---

## 4. Branch-graph feasibility (deferral note)

`git log --graph --pretty=format:...` *can* be parsed into a `GitGraphLane[]` — each graph-char prefix (`*`, `|`, `/`, `\`, `-`, and the box-drawing runes) is per-line and reconstructable into lane positions. However, mixing `--graph` with the `%x1f`/`%x1e` record delimiters forces a more complex line-aware parser than `gitHistory` needs for v0.8's plain list. **Recommendation: design the data shape for graphs now, but don't build rendering yet.** Capturing `parents` (`%P`) in `GitCommit` costs nothing extra today and gives v0.8 everything required to compute lanes (parent→child adjacency) without breaking this contract. We deliberately do **not** emit `graph` lanes in v0.7; `GitCommit` already carries the `parents` field so the shape is forward-compatible. Lane computation and a `graph?: { lane: number }` extension can land in v0.8 with no breaking change.

---

## 5. Test plan

### Existing tests — will anything break?

**No.** `tests/git.test.ts` exercises `gitStatus`, `gitDiff`, `parsePorcelain`, `parseUnifiedDiff`, and the `GitError` paths. The proposed additions are new exported functions and new types; they do not alter existing signatures, parsers, or the `GitError` contract. The `@Remote("gitStatus")` / `@Remote("gitDiff")` surfaces in `src/index.ts` and `src/client.ts` are untouched. No breakage, no migration.

### New tests needed (added in `tests/git.test.ts` or `tests/git-history.test.ts`)

Mirror the existing fixtures (the `repo()` helper that `init`s a temp git repo with user config is reusable):

- **`gitHistory`** —
  - returns commits newest-first with `sha`, `shortSha`, `author`, `email`, `date`, `relativeTime`, `subject`, `parents` populated.
  - `limit` / `offset` pagination: 3 commits + `offset=1` skips the tip correctly.
  - `path` filter restricts to the touched file.
  - `refs` carries a branch/tag decoration after tagging.
- **`gitRepoInfo`** —
  - `headSha`/`headShort`/`branch` correct on the temp repo.
  - ahead/behind = 0/0 with no upstream; correct counts after `git commit` on a branch with a diverged `origin` (set up a second clone as upstream).
- **`gitCommit`** —
  - `files` reports correct `path`, `status`, `insertions`, `deletions` (compare to `git show --numstat` expectations).
  - `diff` is the unified diff; `diffTruncated` is `true` when a generated large commit exceeds `GIT_COMMIT_MAX_DIFF_BYTES`.
  - rejects a missing/unknown sha with a `GitError`.
- **Parser safety** — subjects/bodies containing newlines and spaces parse without corruption (delimiter-based, like `parsePorcelain`).
- **Fail-closed** — `gitHistory`/`gitRepoInfo`/`gitCommit` throw `NOT_A_GIT_REPOSITORY` outside a repo (mirrors `tests/git.test.ts` "fails closed" case).
- **Budget** — a synthetic repo with >200 commits returns at most `GIT_HISTORY_MAX_COMMITS`.

---

## 6. Resolution summary

- **Backend:** shell to `git` (no DSH seam).
- **Contract:** `gitHistory(root, {limit, offset, path})`, `gitCommit(root, sha)`, `gitRepoInfo(root)` in `src/domain/git.ts`, exposed via `@Remote` + `src/client.ts`, types in `src/types.ts`.
- **Budget:** 200 commits / 256 KiB diff / 10 000 ms (reuses `GIT_TIMEOUT_MS`).
- **Graph:** data shape carries `parents` now; lane rendering deferred to v0.8, non-breaking.
