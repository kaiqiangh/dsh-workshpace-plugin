/**
 * Pure unified-diff parser for the Web surface. Kept free of node imports so
 * the browser client bundle can inline it without pulling in `node:child_process`
 * (the git runner in `domain/git.ts` must stay Host-only).
 */
export type DiffLineKind = "header" | "hunk" | "context" | "add" | "remove";
/** Collapsed unchanged region between two hunks; clicking reveals more context. */
export interface ExpanderRow {
    readonly kind: "expander";
    /** Stable hash of the following hunk header; survives re-parses so expand state persists. */
    readonly anchor: string;
    /** Context lines currently revealed (never exceeds `total`). */
    readonly revealed: number;
    /** Context lines still hidden behind the expander. */
    readonly hidden: number;
    /** Full length of the collapsible context run. */
    readonly total: number;
}
export type DiffRow = DiffLine | ExpanderRow;
export type DiffTokenKind = "equal" | "added" | "removed";
export interface DiffToken {
    readonly kind: DiffTokenKind;
    readonly text: string;
}
export interface DiffLine {
    readonly kind: DiffLineKind;
    readonly text: string;
    /** Text without the leading marker (`+`/`-`/` `); the word diff runs on this. */
    readonly content?: string;
    readonly oldLine?: number;
    readonly newLine?: number;
    /**
     * Intra-line token segments for add/remove lines. Absent when the
     * Operational Budget guard disabled word-level highlighting (the renderer
     * then falls back to line-level coloring using `text`).
     */
    readonly tokens?: readonly DiffToken[];
}
export interface IntraLineOptions {
    /**
     * Maximum content length (chars) of a changed line before word-level
     * highlighting is skipped for the whole diff. Operator-tunable.
     */
    readonly maxLineLength?: number;
    /**
     * Maximum number of parsed lines before word-level highlighting is skipped
     * for the whole diff. Operator-tunable.
     */
    readonly maxLineCount?: number;
}
/** Operational Budget for inter-hunk context collapsing. */
export interface CollapseOptions {
    /** Context lines kept visible around a collapsed region (default 3, like git). */
    readonly contextLines?: number;
}
export declare const DEFAULT_CONTEXT_LINES = 3;
/** Lines revealed per expander click (GitHub-style progressive expansion). */
export declare const DEFAULT_EXPAND_STEP = 20;
/**
 * Stable, dependency-free string hash (FNV-1a). Used to anchor expander rows
 * to the hunk they precede so collapse state survives re-parses and refreshes.
 */
export declare function hunkAnchor(text: string): string;
/**
 * Turn parsed diff lines into render rows with inter-hunk context collapsing.
 *
 * A *gap* is the span between two change blocks: the trailing context of the
 * previous block, the following hunk header, and the leading context of the
 * next block. Gaps that follow a change block and contain a hunk header keep up
 * to `contextLines` lines of context on EACH side (default 3, git's default
 * context), then hide the *middle* — the hunk header plus any leading context
 * beyond the budget — behind an `expander` row. Expanding reveals the middle
 * incrementally. For a standard 7-unit gap (3 ctx + @@ + 3 ctx) the middle is
 * just the hunk header, so the expander reads "Show 1 hidden line" and acts as
 * a hunk-boundary marker; larger gaps hide proportionally more. Leading context
 * of a file's first hunk and trailing context at the end are never collapsed
 * (they don't follow a change block). Pure and bounded: it only reorders or
 * reduces the parsed lines it is given.
 */
export declare function buildDiffRows(parsed: readonly DiffLine[], revealed: ReadonlyMap<string, number>, options?: CollapseOptions): readonly DiffRow[];
export interface UnifiedDiff {
    readonly lines: readonly DiffLine[];
    readonly insertions: number;
    readonly deletions: number;
    /** Whether intra-line token segments were computed (false when the guard tripped). */
    readonly intraLine: boolean;
}
/**
 * Pair two sequences positionally, padding with `null` on the shorter side.
 * Shared by the intra-line word diff (removes vs adds) and the split-view
 * renderer (old column vs new column) so the pairing shape lives in one place.
 */
export declare function pairByIndex<T>(left: readonly T[], right: readonly T[]): readonly (readonly [T | null, T | null])[];
/**
 * Parse a unified diff into colored line groups with running line numbers and
 * (when the Operational Budget allows) intra-line token segments for changed
 * lines. Pure and bounded: it only inspects the text it is given, so the Web
 * surface can render readable add/remove/context lines without another dependency.
 */
export declare function parseUnifiedDiff(diffText: string, options?: IntraLineOptions): UnifiedDiff;
