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
export function parseUnifiedDiff(diffText: string): UnifiedDiff {
  const lines: DiffLine[] = [];
  let insertions = 0;
  let deletions = 0;
  let oldLine = 0;
  let newLine = 0;
  for (const raw of String(diffText ?? "").split("\n")) {
    if (raw === "") continue;
    // `--- a/x` / `+++ b/x` are file headers, not remove/add lines.
    if (raw.startsWith("---") || raw.startsWith("+++")) {
      lines.push({ kind: "header", text: raw });
      continue;
    }
    if (raw.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(raw);
      oldLine = match ? Number(match[1]) : 0;
      newLine = match ? Number(match[2]) : 0;
      lines.push({ kind: "hunk", text: raw });
      continue;
    }
    const marker = raw[0];
    if (marker === "+") {
      lines.push({ kind: "add", text: raw, ...(newLine > 0 ? { newLine } : {}) });
      newLine += 1;
      insertions += 1;
      continue;
    }
    if (marker === "-") {
      lines.push({ kind: "remove", text: raw, ...(oldLine > 0 ? { oldLine } : {}) });
      oldLine += 1;
      deletions += 1;
      continue;
    }
    if (marker === " ") {
      lines.push({ kind: "context", text: raw, ...(oldLine > 0 ? { oldLine } : {}), ...(newLine > 0 ? { newLine } : {}) });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    lines.push({ kind: "header", text: raw });
  }
  return { lines, insertions, deletions };
}
