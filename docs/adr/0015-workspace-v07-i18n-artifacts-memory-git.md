# ADR 0015 — Workspace v0.7: locale, artifacts, memory, Git

- **Status:** accepted
- **Date:** 2026-08-19
- **Tickets:** wayfinder map #117 — research #118/#119/#120/#122, prototypes #123/#124, IA #125, impl #126/#127/#128/#129, verification #130
- **Supersedes:** part of ADR 0011's v0.7 surface scope, now delivered

## Context

v0.6 shipped the Workspace conversation tab (Artifacts / Memory / Changes) with
a zero-dependency EN/ZH dictionary, but four gaps remained:

1. **Locale desync.** Surfaces rendered in `navigator.language` while the
   DeepSeek app language could differ; the tab label was a frozen `"Workspace"`
   constant.
2. **`undefined` summary.** A partial summary payload painted
   `undefined files · undefined added · …` because the v0.6 chat-card→block
   migration dropped the shape validator.
3. **Artifacts reachability.** A normal session whose agent id was not yet
   registered hit a thrown `PROJECT_UNAVAILABLE`, rendering the misleading
   "Workspace artifacts are unavailable." notice.
4. **No Git history** and a Memory surface that worked but felt like an admin
   form.

Research (#118–#122) established: the host exposes **no public locale event or
hook**; the summary bug is a missing guard in the web block; artifacts **do**
flow end-to-end once the missing-agent throw is fixed; and there is **no DSH
SCM/history seam** — history must shell to `git`.

## Decisions

### 1. Locale subscriber (follow the app, browser as fallback)

The host has no public locale seam (#118), so the plugin follows the app
language the same way the host itself does:

- `startWorkspaceLocaleSync()` observes the `<html lang>` attribute
  (`MutationObserver`) and the `languagechange` event, and calls
  `setWorkspaceLocale(...)`.
- A reactive layer in `workspace-i18n.ts` (`subscribeWorkspaceLocale`,
  `useWorkspaceLocale` via `useSyncExternalStore`) re-renders every surface on
  change.
- The tab label is `label: () => t("view.workspace")` so the host's
  locale-aware lookup (the `dsh-workspace` namespace) takes over.
- `navigator.language` remains the initial/fallback only.

Zero new dependency; no separate i18n framework.

### 2. Zero-`undefined` rule (defensive rendering)

`validSummaryShape` guards the summary payload; partial/garbled data downgrades
to the localized "Workspace summary is unavailable." state. As a top-level
rule for every surface: numeric metrics default to `0`, missing strings to
`—`, and absent data to a friendly empty/unavailable state — the literal
`undefined` never reaches the DOM.

### 3. Artifacts missing-agent guard

`artifactMetadata` returns `[]` (empty state) and `previewArtifact` returns an
error descriptor when the agent is unregistered, instead of throwing
`PROJECT_UNAVAILABLE`. A real session's artifacts then surface normally.
#120's end-to-end test proves the carrier emits deliverables from
`tool/call`+`tool/result` records through the Typert bridge into the surface.

### 4. Memory IA (inline scope, list + detail + governance)

- Scope stays an **inline segmented control** (Project / Session / User /
  Shared Project) with one-line tooltips — never a top-level tab.
- Record cards show title, type + verification chips (max two), scope, relative
  updated time, one-line preview.
- Detail panel: scrollable content, governance table (Origin / Verification /
  Retention / Revision / Sources / Expires) with explainer tooltips, and an
  action row (Edit, Verify/Re-verify, Archive, Forget w/ confirmation,
  Pin/Unpin, Copy, View source), plus a collapsible inline editor. Shared
  Project is read-only until acknowledged.
- All remotes and the component API are preserved (no client changes).

### 5. Git tab (Changes + History under one section)

- Tab order locked: **Artifacts → Memory → Git**.
- Git is **one tab** with a shared repo-status header (branch + short head,
  dirty/clean pill, staged/unstaged/untracked counts, ahead/behind, refresh)
  and an internal **Changes / History** segmented switch.
- History backend **shells to `git`** (no DSH seam, #122): `gitHistory`,
  `gitCommit`, `gitRepoInfo` in `src/domain/git.ts` with budgets — 200 commits,
  256 KiB diff per commit, 10 s timeout (mirrors `GIT_TIMEOUT_MS`).
- The commit list reserves a horizontal branch-graph placeholder bar; v0.8 can
  add graph geometry without a data-shape break (`GitCommit.parents` is
  carried from day one).
- Non-Git workspaces show a centered empty state ("This workspace is not a Git
  repository."), never a spinner or error.

## Consequences

- Workspace now renders in the app's language everywhere, and can never paint
  `undefined` metrics.
- Artifacts is a working inspection surface (size, relative mtime, preview
  status, copy-path, download, distinct unsupported/error states).
- Memory is a readable governance surface instead of a debug form.
- Git changes and history are both visible from Workspace; the data shape is
  graph-ready for a later branch visualization.
- The typert bridge now exposes three new remotes (`gitHistory`, `gitCommit`,
  `gitRepoInfo`); `lib/` is regenerated at build time.
- Cost: one `git` subprocess per history call, bounded by the budgets above.

## Test evidence (verification #130)

Full suite **218 pass / 0 fail** on `dev` (locale en/zh + no-`undefined`
summary, artifacts empty/preview/unsupported/error/copy-path, memory scopes /
search / filters / selection / long content / actions, git clean / modified /
untracked / staged / diff / non-git / history list + per-commit diff). `npm
run check` and `npm run build` (tsc) green. One pre-existing timing flake
(`workspace-memory-auto-write` prune) hardened with a settle wait.
