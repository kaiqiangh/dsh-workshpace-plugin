/**
 * Pure unified-diff parser for the Web surface. Kept free of node imports so
 * the browser client bundle can inline it without pulling in `node:child_process`
 * (the git runner in `domain/git.ts` must stay Host-only).
 */
export type DiffLineKind = "header" | "hunk" | "context" | "add" | "remove";
export interface DiffLine {
    readonly kind: DiffLineKind;
    readonly text: string;
    readonly oldLine?: number;
    readonly newLine?: number;
}
export interface UnifiedDiff {
    readonly lines: readonly DiffLine[];
    readonly insertions: number;
    readonly deletions: number;
}
/**
 * Parse a unified diff into colored line groups with running line numbers.
 * Pure and bounded: it only inspects the text it is given, so the Web surface
 * can render readable add/remove/context lines without another dependency.
 */
export declare function parseUnifiedDiff(diffText: string): UnifiedDiff;
