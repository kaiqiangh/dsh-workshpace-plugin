# DSH Workspace Plugin — Changelog

All notable changes to this plugin are recorded here, newest first.

## v0.6.0 (2026-08-17) — history-resume fix, dsh-web-ui preview port, full i18n

**History-resume bug fix (the headline)**

- **Fixed: reopened historical sessions were unloadable.** The host used to
  persist a custom `workspace/summary` event via `session.append`; DSH's cold
  persistence path rejects unknown non-ignorable event types, so any restarted
  session whose log contained it refused to load (`openState=error` — missing
  chat card and empty tab data). v0.6 **stops persisting the event entirely**
  (wayfinder #110/#112): the summary is derived on demand from allow-listed
  durable tool records (`tool/call` + `tool/result`) through the existing pure
  `workspaceSummaryFor` and a new `workspaceSummary` remote. Historical
  sessions created before v0.6 whose logs already contain the event remain
  unloadable by the DSH persistence layer (no safe in-place log rewrite);
  new sessions are clean. See README troubleshooting.
- The chat summary card (event-driven `conversation.chat.node`) is replaced by
  a **summary block at the top of the Workspace tab**, polling the
  `workspaceSummary` remote — identical for live and resumed sessions.

**dsh-web-ui preview port (read-only, ADR 0014)**

- **Markdown previews render through a self-contained Workspace renderer**
  (GFM subset: headings, paragraphs, code, bold/italic/strike, links, images,
  lists, blockquotes, hr, tables) instead of `MarkdownText`. Relative images
  resolve to same-origin opaque resource URLs (`PreviewService.markdownImageUrl`),
  so images beside the file display in the preview; remote images stay dropped.
- **Mermaid fences render as diagrams** via a same-origin vendor bundle
  (`/workspace/vendor/mermaid.js`, shipped in `lib/assets/` at build time —
  zero runtime npm dependency) that follows the shell light/dark theme.
- **PDF previews stream with Range/ETag**: `/workspace/resource` answers
  206/416 byte ranges and 304 revalidation (no-cache), so large PDFs can seek.

**Artifacts**

- **Read-only multi-tab preview** (dsh-web-ui PreviewTabs pattern, minus
  editing): open several artifacts as tabs, switch/close, per-tab cached
  descriptors. No editor/split/save (read-only stance preserved).
- Full English/Chinese copy.

**Changes**

- **Grouped SCM display**: staged / unstaged / untracked section headers
  (dsh-web-ui ScmPanel grouping) alongside the existing filter chips; the
  untracked "stage it to see a diff" notice is kept. Still read-only.
- Full English/Chinese copy.

**Memory**

- Full English/Chinese copy.

**i18n**

- A zero-dependency dictionary (`workspace-i18n.ts`) covers every surface and
  remote error message; the locale follows the browser language.

**Documentation**

- ADR 0014 records the v0.6 decisions.
- README updated (summary block replaces the chat card; history-resume
  troubleshooting note; mermaid/PDF/multi-tab/grouped-changes features).


**Workspace tab chrome**

- Tab bar restyled as a segmented control with a strong active state, focus rings, and theme-adaptive tokens.
- Diff add/remove color semantics added to the visual system (green add / red remove with left-border indicators).

**Git Changes board (readability + operations)**

- Diffs now render as colored, line-numbered unified diff blocks (hunk headers, add/remove/context coloring) via a new pure `parseUnifiedDiff()` parser.
- Per-file `+N −M` insertion/deletion stats shown in the diff header.
- Untracked files show a friendly "stage it to see a diff" notice instead of the old confusing "No diff content".
- Added auto-refresh (5s, matching Artifacts) and a manual Refresh button; the previous behavior loaded once on mount.
- Added status filter chips (All / Added / Modified / Deleted / Untracked / Staged).
- Added a Copy-diff control.
- Selection persists across refreshes; error copy is now friendly instead of raw `CODE: message`.

**Artifacts surface**

- Added debounced search-as-you-type name filtering.
- Each item now shows a preview-status chip (available / unsupported / oversized / stale).
- Detail pane sits beside the list on wide screens (stacks on narrow) instead of falling below the fold.
- Download simplified to one click (fetch → object URL → programmatic download).
- One malformed artifact no longer fails the whole list (lenient normalization with a "N hidden" warning).

**Memory surface**

- Toolbar regrouped into two rows: scope switcher (segmented) on row one; search, filters, export, and import on row two.
- Conflict comparison versions now have clear visual identity (selected = green, conflict = amber).
- Editor action buttons grouped in a row with the primary action emphasized.
- Shared primitives (`workspace-primitives.ts`) and friendly error messages (`workspace-remote.ts`) used by all three surfaces.

**Correctness & performance**

- Host artifact carrier now caches preview descriptors keyed by path + size + mtime; the 5s poll is stat-only, and file previews are re-read only when a file changes.
- The artifact carrier is now keyed by session + working directory, so a session that switches directories no longer sees stale artifacts; Memory keeps its fail-closed contract (a session rebound to another Workspace Root still rejects).
- Removed duplicated RemoteResult unwrappers and duplicated resource-URL builders (single `workspaceResourceUrl`).
- `check` script now globs `src/**/*.ts` automatically instead of a hand-maintained file list.

**Documentation**

- README updated to the v0.3 delivered reality.
- This changelog added.
- ADR-0011 records the v0.3 surface-UX and hygiene decisions.
- The 2026-08-16 codebase review is marked superseded.

## v0.2.0 (2026-08-16) — Workspace tab, auto-written Memory, surface redesign

- Workspace became the sole entry as a `conversation.view` tab beside Trajectory (floating pill removed).
- Added the Changes view with Git status list and unified diff preview.
- Added per-session Memory auto-writer (derived facts from agent tool activity).
- Wired `memoryMarkUsed` / `memoryClose` seams; fixed the summary-card data flow.
- Added Agent-driven Memory proposals (`workspace_memory_propose`) as unverified review items.
- Redesigned Artifacts / Memory / Changes surfaces on a shared card visual system.
- Retired v0.2 Working Set scaffolding (ADR-0010); updated PRD/ARD/README/CONTEXT.
