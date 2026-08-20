# Research finding: v0.8 Git history topology and branch graph

- Issue: [Research: Verify Git history topology and branch-graph data contract](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/134)
- Branch: `research/git-graph`
- Source snapshot: `83af760` (`dev`), Git `2.53.0`, Node `24.19.0`
- Scope: read-only seam inspection plus disposable temporary repositories. No product code or `lib/` changes are proposed; the graph contract remains read-only.

## Decision

The current seam is sufficient for a small v0.8 graph of the commits reachable from
the current `HEAD`: `GitCommit.parents` already carries the full parent edges and
`decorations` carries ref labels. It is not sufficient for a Git-Graph-style view of
unmerged sibling branches because `gitHistory` walks the default `HEAD` range only.

The smallest useful v0.8 extension is:

```ts
interface GitHistoryOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly scope?: "head" | "localBranches"; // default: "head"
}
```

Keep the existing `GitCommit` shape, derive lane geometry in the client from
`sha` → `parents`, and implement `scope: "localBranches"` with Git's
`--branches --topo-order --decorate=short`. Do not add a second refs endpoint or
emit server-side lane coordinates yet. Git documents `--branches` as including all
`refs/heads` tips, while `--topo-order` prevents a parent from appearing before its
children and avoids intermixing parallel lines. ([git-rev-list](https://git-scm.com/docs/git-rev-list#_commit_ordering))

## What the current seam exposes

### `gitHistory`

`GitCommit` already contains full `sha`, ordered full `parents`, author, author epoch
time, subject, and one raw `decorations` string. The domain parser emits `%H`, `%P`,
`%an`, `%at`, `%s`, and `%D` with control-character delimiters, then calls
`git log --max-count <limit> --skip <offset> ... --decorate=short`.
([`src/domain/git.ts#L33-L51`](../src/domain/git.ts#L33-L51),
[`src/domain/git.ts#L227-L260`](../src/domain/git.ts#L227-L260))

This is graph-ready for one reachable history. Git's `%P` is the parent-hash
placeholder and `%D` is the unwrapped ref-decoration placeholder.
([pretty formats: `%P`](https://git-scm.com/docs/pretty-formats#_placeholders_that_expand_to_information_extracted_from_the_commit),
[pretty formats: `%D`](https://git-scm.com/docs/pretty-formats#_placeholders_that_expand_to_information_extracted_from_the_commit))

The important boundary is the revision range: without an explicit range, `git log`
defaults to `HEAD` and lists commits reachable by following parent links. The current
implementation supplies no `--all` or `--branches` argument.
([git-log](https://git-scm.com/docs/git-log#_description),
[`src/domain/git.ts#L238-L243`](../src/domain/git.ts#L238-L243))

### `gitCommit`

The detail call re-reads metadata, obtains file stats with `git diff-tree ... -r`,
and obtains a bounded `git show --format=` diff. It returns the same `GitCommit`
including `parents`, plus `files`, `diff`, and `diffTruncated`.
([`src/domain/git.ts#L262-L303`](../src/domain/git.ts#L262-L303))

Merge detail has a real limitation: Git uses combined diff format for merge commits
by default. In the fixture below, a two-parent merge correctly returned two parents,
but `files` was empty and `diff` was 0 bytes. That is a valid result of the current
command, not evidence that the merge has no changes. Git's documentation describes
combined diff as the merge default and documents `--diff-merges` for selecting a
different comparison.
([git-show: combined diff](https://git-scm.com/docs/git-show#_combined_diff_format),
[`src/domain/git.ts#L274-L301`](../src/domain/git.ts#L274-L301))

### `gitRepoInfo`

`gitRepoInfo` returns only `isGit`, active `branch`, short `head`, and numeric
`ahead`/`behind` counts. Branch and head are read with `rev-parse`; ahead/behind is
`git rev-list --left-right --count HEAD...@{u}`, degraded to `0/0` when there is no
upstream or the comparison is unavailable. It does not return a list of local or
remote branches.
([`src/domain/git.ts#L67-L77`](../src/domain/git.ts#L67-L77),
[`src/domain/git.ts#L305-L336`](../src/domain/git.ts#L305-L336),
[git-rev-list `--left-right`/`--count`](https://git-scm.com/docs/git-rev-list#_options))

## Disposable fixture results

The following bounded fixtures were created and removed under the system temporary
directory. The command exercised the exported domain functions directly, so these
are observations of the actual shell-backed seam rather than mocked remote values.

| Fixture | Observed result | Contract consequence |
| --- | --- | --- |
| Two-parent `--no-ff` merge, `main` + `feature` + tag | `gitHistory` returned the merge first with two parent SHAs; the merged feature commit was also present and decorated `feature`; the merge was decorated `HEAD -> main, tag: v1.0`. | Current reachable history contains enough parent edges to compute lanes for merge topology. |
| Unmerged local `feature` beside `main` | On `main`, `gitHistory` returned `main` and its base only; the feature tip was absent. `git log --all` showed the feature tip. | A Git-Graph view of other local branches needs an explicit all-local-branches scope; decorations alone cannot reveal commits not returned. |
| Detached `HEAD` at an older commit | `gitRepoInfo` returned `{ isGit: true, branch: "HEAD", head: <short> }`; history decorated the tip as `HEAD`. | UI can infer and label detached state from existing fields; it must not present `HEAD` as a named branch. Git documents detached HEAD as HEAD pointing directly at a commit. ([git-checkout](https://git-scm.com/docs/git-checkout#_detached_head)) |
| Unborn `main` after `git init --initial-branch=main` | `gitRepoInfo` returned `{ isGit: true, branch: "", head: "", ahead: 0, behind: 0 }`; `gitHistory` threw `GitError` code `GIT_UNAVAILABLE` because `git log` reported that the branch has no commits. | Treat this as a normal empty-repository state before graph rendering; current history degrades to an error notice instead of the existing empty-history state. Git defines `git init` as creating an initial branch without commits and calls it an unborn branch. ([git-init](https://git-scm.com/docs/git-init#_description), [git glossary](https://git-scm.com/docs/gitglossary#_unborn_branch)) |
| 205 synthetic linear commits | `limit: 999` returned exactly `200`; `limit: 2, offset: 1` returned the next two commits; an offset past the end returned an empty array. | Existing budget is a hard 200-commit page. The array has no cursor, total, or `hasMore` field; v0.8 should show a bounded/truncated state and defer cursor semantics. |

Existing tests cover simple parent/decorations parsing, offset pagination, the 200
commit clamp, upstream counts, non-Git roots, and basic history preview rendering.
They do not cover merge topology, unmerged branch omission, detached HEAD, unborn
repositories, or merge detail diffs.
([`tests/workspace-git-history.test.ts#L35-L83`](../tests/workspace-git-history.test.ts#L35-L83),
[`tests/workspace-git-history.test.ts#L118-L177`](../tests/workspace-git-history.test.ts#L118-L177),
[`tests/workspace-history-surface.test.ts#L57-L120`](../tests/workspace-history-surface.test.ts#L57-L120))

## Current history preview

The remote seam is mounted as three read-only methods on the session's resolved
Workspace Root; no write operation is involved.
([`src/index.ts#L289-L308`](../src/index.ts#L289-L308),
[`src/client.ts#L100-L108`](../src/client.ts#L100-L108))

The browser requests one page of 200 commits and does not pass `offset`. The list
shows a seven-character hash, subject, raw decorations, author, and relative age;
the detail view shows the full hash, decorations, subject, parents as a comma-joined
string, file stats, and per-file diff blocks.
([`src/web/workspace-history-surface.ts#L10-L21`](../src/web/workspace-history-surface.ts#L10-L21),
[`src/web/workspace-history-surface.ts#L122-L161`](../src/web/workspace-history-surface.ts#L122-L161),
[`src/web/workspace-history-surface.ts#L171-L187`](../src/web/workspace-history-surface.ts#L171-L187),
[`src/web/workspace-history-surface.ts#L198-L239`](../src/web/workspace-history-surface.ts#L198-L239))

The apparent graph is only a placeholder: `graphBar` renders `*` plus the first
commit's decoration (or short SHA), marks it `aria-hidden`, and renders no lane or
edge. The existing CSS styles it as a dashed monospace strip above independent
rounded commit cards. This explains why the preview cannot communicate merges or
other branches even though `parents` is already visible in the detail metadata.
([`src/web/workspace-history-surface.ts#L164-L169`](../src/web/workspace-history-surface.ts#L164-L169),
[`src/web/workspace-styles.ts#L1764-L1851`](../src/web/workspace-styles.ts#L1764-L1851))

## Smallest v0.8 implementation boundary

1. Add only `scope?: "head" | "localBranches"` to `GitHistoryOptions`, defaulting
   to the current behavior. For `localBranches`, add `--branches --topo-order` to
   the existing read-only `git log` invocation; keep the 200/256 KiB/10 s budgets.
   `--all` is broader than needed because Git defines it over all refs, including
   refs outside local branch heads. ([git-rev-list `--all` and `--branches`](https://git-scm.com/docs/git-rev-list#_commit_limiting))
2. Keep `GitCommit.parents` and `decorations` as the graph data contract. Build
   client-only lane/edge rows from parent SHA lookups; do not add a server graph
   renderer or a second refs endpoint yet.
3. Make the UI state explicit: current branch, detached `HEAD`, unborn/empty repo,
   and "older commits omitted" at the 200 boundary. If a page is full, the UI can
   request the next `offset` page; a stable cursor/total contract is unnecessary for
   the first graph pass.
4. For merge selection, show the two-parent/merge badge and a clear
   "combined diff is empty or unavailable" state when the current detail result has
   no files/diff. Parent-specific merge comparisons (`-m` or another
   `--diff-merges` mode) should be a separate decision, not hidden inside the graph
   work.

### Explicitly out of scope for this contract

- Git writes, branch checkout/create/delete, commit actions, or reflog browsing.
- Remote branch synchronization and upstream mutation.
- Full commit messages for every row, server-side lane geometry, or an unbounded
  history/graph canvas.

## Verification record

- `node --experimental-strip-types --test tests/workspace-git-history.test.ts tests/workspace-history-surface.test.ts tests/workspace-git-surface.test.ts`
  → **21 passed, 0 failed**.
- Temporary fixture command covered merge, unmerged local branches, detached HEAD,
  unborn repo, 200-commit budget, offset pagination, and merge detail behavior.
- Repository product paths remain unchanged; this note is the only intended file on
  `research/git-graph`.
