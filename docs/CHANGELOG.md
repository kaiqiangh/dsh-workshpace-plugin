# DSH Workspace Plugin — Changelog

All notable changes to this plugin are recorded here, newest first.

## v0.3.0 (2026-08-16) — Surface UX & hygiene

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
