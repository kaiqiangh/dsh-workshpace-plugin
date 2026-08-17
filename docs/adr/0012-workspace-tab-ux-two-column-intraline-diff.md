# ADR 0012: v0.4 Workspace tab UX — unified two-column surfaces and intra-line diff

- **Status:** Accepted
- **Date:** 2026-08-17
- **Context:** The user wants to optimize the overall Workspace tab UI/UX, especially the Changes (git diff) preview. ADR 0011 (v0.7) shipped line-level diff readability, shared primitives, and a 5s refresh, but the v0.7 two-column `columns` CSS (`minmax(250px,340px)` list | `1fr` detail, collapses <760px) was defined and **never wired into any surface** — Changes still stacks the file list above the diff, so the list scrolls out of view while reading a diff. This round extends the existing visual system rather than adding new atoms.

## Decision

1. **Unified two-column list|detail for all three surfaces.** Wire the existing `columns` / `column-list` / `column-detail` CSS (dead since v0.7) into Artifacts, Memory, and Changes. The list column stays visible while the detail/preview renders beside it; below 760px it collapses to a single stacked column (preserves ADR 0009 responsiveness).
2. **Intra-line (word-level) diff.** Extend `parseUnifiedDiff()` so added/removed `DiffLine`s carry token segments (`equal`/`added`/`removed`); render changed words highlighted within each line **independently** (no cross-line pairing of deletions with insertions). Zero new dependencies — keeps ADR 0011's no-syntax-highlighting constraint.
3. **Operational Budget guard for word diff.** Word-level highlighting is skipped and falls back to line-level coloring when a line exceeds a tunable max length or the parsed diff exceeds a tunable max line count. Safe defaults are set; thresholds are operator-tunable under the Operational Budget vocabulary.
4. **Single-file selection retained; read-only preserved.** Changes keeps one selected path (staged + unstaged diff). The two-column layout keeps the selection visible beside the diff. No stage/unstage actions (read-only). Control set stays minimal: copy diff, line numbers, line-wrap, word highlight. No in-diff search, hunk collapse, or unified/split toggle.
5. **Shared primitives only.** All three surfaces reuse `workspace-primitives.ts` atoms and the scoped `columns` / `diff-*` styling. No per-surface UI atoms (per ADR 0011 consequence).

## Considered Options

- **Syntax highlighting** — rejected: would break ADR 0011's explicit zero-dependency constraint and is not needed for a read-only inspection surface.
- **Cross-line word pairing (deletion ↔ insertion)** — rejected: more parser complexity for marginal gain; per-line independent highlighting is sufficient and bounded.
- **Stacked layout (status quo)** — rejected: the list and diff are mutually exclusive on screen, the core UX defect this ADR fixes.
- **Search / hunk-collapse / split-toggle controls** — deferred: out of scope for the minimal control set; can be a later ADR if users ask.

## Consequences

- Changes diff previews beside a persistent file list; selecting a file no longer loses the list.
- `DiffLine` gains an optional token-segment structure; line-level-only consumers ignore it. Parser cost stays bounded by the guard in Decision 3.
- Word-level rendering is a pure, bounded, dependency-free enhancement consistent with ADR 0011.
- **Out of scope:** split/unified toggle, in-diff search, hunk folding, any write/stage actions, syntax highlighting.
