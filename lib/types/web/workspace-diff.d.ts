/**
 * Pure unified-diff parser for the Web surface. Kept free of node imports so
 * the browser client bundle can inline it without pulling in `node:child_process`
 * (the git runner in `domain/git.ts` must stay Host-only).
 */
export type DiffLineKind = "header" | "hunk" | "context" | "add" | "remove";
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
export interface UnifiedDiff {
    readonly lines: readonly DiffLine[];
    readonly insertions: number;
    readonly deletions: number;
    /** Whether intra-line token segments were computed (false when the guard tripped). */
    readonly intraLine: boolean;
}
/**
 * Parse a unified diff into colored line groups with running line numbers and
 * (when the Operational Budget allows) intra-line token segments for changed
 * lines. Pure and bounded: it only inspects the text it is given, so the Web
 * surface can render readable add/remove/context lines without another dependency.
 */
export declare function parseUnifiedDiff(diffText: string, options?: IntraLineOptions): UnifiedDiff;
