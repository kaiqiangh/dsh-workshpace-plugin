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
 * Mutable shape used only while the parser is being built. `flush()` fills in
 * `tokens` in place; the finished array is exposed to callers as the read-only
 * `DiffLine` (so consumers can't mutate what they receive).
 */
interface MutableDiffLine {
  kind: DiffLineKind;
  text: string;
  content?: string;
  oldLine?: number;
  newLine?: number;
  tokens?: readonly DiffToken[];
}

const DEFAULT_MAX_LINE_LENGTH = 512;
const DEFAULT_MAX_LINE_COUNT = 4000;

/** Split into whitespace and non-whitespace runs so the word-level diff is granular. */
function tokenizeWords(value: string): readonly string[] {
  return value.match(/\s+|[^\s]+/gu) ?? [];
}

/** LCS alignment over two token arrays; marks which tokens are shared. */
function alignTokens(a: readonly string[], b: readonly string[]): { readonly aCommon: boolean[]; readonly bCommon: boolean[] } {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const aCommon = new Array<boolean>(n).fill(false);
  const bCommon = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      aCommon[i] = true;
      bCommon[j] = true;
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return { aCommon, bCommon };
}

/** Word-level diff of one removed line against one added line. */
function diffLineWords(removed: string, added: string): { readonly removedTokens: DiffToken[]; readonly addedTokens: DiffToken[] } {
  const a = tokenizeWords(removed);
  const b = tokenizeWords(added);
  const { aCommon, bCommon } = alignTokens(a, b);
  const removedTokens = a.map((text, index) => ({ kind: (aCommon[index] ? "equal" : "removed") as DiffTokenKind, text }));
  const addedTokens = b.map((text, index) => ({ kind: (bCommon[index] ? "equal" : "added") as DiffTokenKind, text }));
  return { removedTokens, addedTokens };
}

function isChangedLine(line: DiffLine): boolean {
  return line.kind === "add" || line.kind === "remove";
}

/**
 * Parse a unified diff into colored line groups with running line numbers and
 * (when the Operational Budget allows) intra-line token segments for changed
 * lines. Pure and bounded: it only inspects the text it is given, so the Web
 * surface can render readable add/remove/context lines without another dependency.
 */
export function parseUnifiedDiff(diffText: string, options: IntraLineOptions = {}): UnifiedDiff {
  const maxLineLength = options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH;
  const maxLineCount = options.maxLineCount ?? DEFAULT_MAX_LINE_COUNT;

  const lines: MutableDiffLine[] = [];
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
      const content = raw.slice(1);
      lines.push({ kind: "add", text: raw, content, newLine });
      newLine += 1;
      insertions += 1;
      continue;
    }
    if (marker === "-") {
      const content = raw.slice(1);
      lines.push({ kind: "remove", text: raw, content, oldLine });
      oldLine += 1;
      deletions += 1;
      continue;
    }
    if (marker === " ") {
      lines.push({ kind: "context", text: raw, content: raw.slice(1), oldLine, newLine });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    lines.push({ kind: "header", text: raw });
  }

  // Operational Budget guard: skip word-level highlighting when any changed line
  // is too long or the diff is too large. Falls back to plain line-level coloring.
  const intraLine = lines.length <= maxLineCount
    && lines.every((line) => !isChangedLine(line) || (line.content?.length ?? 0) <= maxLineLength);

  if (intraLine) {
    // Pair adjacent change runs: a contiguous block of remove/add lines. Within
    // a block, pair by index and word-diff each pair (bounded, local — no global
    // cross-line alignment). Surplus lines are marked fully added/removed.
    // `DiffLine.content` (text without the leading marker) drives the word diff.
    let blockRemoves: number[] = [];
    let blockAdds: number[] = [];
    const flush = (): void => {
      const count = Math.max(blockRemoves.length, blockAdds.length);
      for (let index = 0; index < count; index += 1) {
        const removedIndex = blockRemoves[index];
        const addedIndex = blockAdds[index];
        const removed = removedIndex !== undefined ? lines[removedIndex] : undefined;
        const added = addedIndex !== undefined ? lines[addedIndex] : undefined;
        if (removed && added) {
          const { removedTokens, addedTokens } = diffLineWords(removed.content ?? "", added.content ?? "");
          removed.tokens = removedTokens;
          added.tokens = addedTokens;
        } else if (removed) {
          removed.tokens = [{ kind: "removed", text: removed.content ?? "" }];
        } else if (added) {
          added.tokens = [{ kind: "added", text: added.content ?? "" }];
        }
      }
      blockRemoves = [];
      blockAdds = [];
    };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (line.kind === "remove") blockRemoves.push(index);
      else if (line.kind === "add") blockAdds.push(index);
      else flush();
    }
    flush();
  }

  return { lines, insertions, deletions, intraLine };
}
