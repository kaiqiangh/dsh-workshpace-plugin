# ADR 0013: v0.5 Workspace Conversation Tab — diff navigation, live-refresh comfort, and aesthetic polish

- **Status:** Accepted
- **Date:** 2026-08-17
- **Context:** A grill-with-docs session revisited the Workspace Conversation Tab UX after ADR 0012 (v0.4) shipped. The user confirmed four pains: long diffs are hard to navigate, no split view, no prev/next file navigation, and the 5s refresh interrupts reading; they also wanted an aesthetic-grade polish pass across all three surfaces plus the tab switch itself. A comparative study of GitHub, GitLab, VS Code, JetBrains, and delta informed each decision. ADR 0011's constraints hold: zero dependencies, read-only, shared primitives only (polish lands in shared atoms, never per-surface UI).

## Decision

1. **Unified/split toggle with a 900px auto-breakpoint.** When the carrier (Workspace Panel or Workspace Conversation Tab) is ≥900px wide, a unified/split toggle appears; below 900px the diff is forced unified (VS Code's `renderSideBySideInlineBreakpoint` pattern). The toggle choice is remembered per carrier.
2. **Inter-hunk context collapsing + per-file collapse.** Unchanged regions between hunks collapse to a "N hidden lines" expander showing 3 context lines by default (git default); clicking expands ±20 lines progressively (GitHub pattern). The sticky file header gains a chevron to collapse the whole file (GitLab pattern). Collapse state survives the 5s refresh, keyed by a hash of the hunk header text. No per-hunk manual folding.
3. **Hybrid refresh comfort.** The 5s poll continues. If the selected file's diff text is unchanged, re-render silently while preserving scroll anchor, selection, and collapse state. If it changed, do not reflow under the reader — float a "New changes · Refresh" pill that applies the update on click.
4. **Prev/next file navigation.** Sticky file header carries ‹ › buttons to move between files in the current filter. `[` / `]` keyboard shortcuts do the same, but only while the Workspace surface has focus, so the Harness host's keyboard handling is never hijacked.
5. **Aesthetic polish, GitHub two-tone + delta hierarchy.** Diff lines keep pale add/remove backgrounds with a stronger shade for intra-line tokens (already shipped in v0.4); file headers become a strong band and `@@` hunk headers are dimmed (delta-style hierarchy). The `--dsw-*` token system in `workspace-styles.ts` is consolidated — 4px spacing base, a type ramp, unified radius — and all three surfaces plus the tab switch are normalized onto shared atoms: empty-state copy, filter chips, section headers.

## Considered Options

- **Always-on split toggle (no breakpoint)** — rejected: narrow Panel users get a broken layout; VS Code auto-degrades for good reason.
- **Unified only this round** — rejected: the Conversation Tab carrier is wide enough that split view is the single most requested diff capability.
- **Per-hunk manual folding (JetBrains-style)** — rejected: marginal gain over inter-hunk collapsing + per-file collapse; extra UI chrome.
- **Pause polling while reading** — rejected as sole mechanism: stale data anxiety; the hybrid pill keeps data fresh without reflowing under the reader.
- **In-diff search** — deferred again (ADR 0012); hunk collapsing + navigation address the same "find my place" pain with far less complexity.
- **Syntax highlighting** — rejected again (ADR 0011/0012): breaks the zero-dependency constraint for a read-only inspection surface.

## Consequences

- `parseUnifiedDiff()` output gains enough structure to render split view and collapsed context (paired old/new line numbers already exist; expander rows are a new line kind).
- Collapse/expand and refresh-anchoring logic lives in pure render-prep functions, keeping tests at the existing seams (parser unit tests, surface render tests).
- The 900px breakpoint and ±20-line expand step join the Operational Budget vocabulary as operator-tunable limits with product ceilings.
- **Out of scope:** in-diff search, syntax highlighting, any write/stage actions, comment/annotation features, three-state (modified-color) palettes.
