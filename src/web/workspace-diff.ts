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

export const DEFAULT_CONTEXT_LINES = 3;
/** Lines revealed per expander click (GitHub-style progressive expansion). */
export const DEFAULT_EXPAND_STEP = 20;

/**
 * Stable, dependency-free string hash (FNV-1a). Used to anchor expander rows
 * to the hunk they precede so collapse state survives re-parses and refreshes.
 */
export function hunkAnchor(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

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
export function buildDiffRows(
  parsed: readonly DiffLine[],
  revealed: ReadonlyMap<string, number>,
  options: CollapseOptions = {},
): readonly DiffRow[] {
  const contextLines = Math.max(0, options.contextLines ?? DEFAULT_CONTEXT_LINES);
  const rows: DiffRow[] = [];
  const trailing: DiffLine[] = [];
  const leading: DiffLine[] = [];
  let gapHunk = ""; // hunk header text inside the gap, "" when none seen yet
  let afterChange = false; // gaps only start right after a change block

  const flushGap = (): void => {
    if (trailing.length === 0 && gapHunk === "" && leading.length === 0) return;
    const keptTrailing = Math.min(contextLines, trailing.length);
    const keptLeading = Math.min(contextLines, leading.length);
    // The middle is the hunk header(s) plus leading context beyond the budget.
    const middle: DiffLine[] = [];
    if (gapHunk !== "") middle.push({ kind: "hunk", text: gapHunk });
    for (let index = 0; index < leading.length - keptLeading; index += 1) middle.push(leading[index]!);
    const middleTotal = middle.length;
    // Collapse only when there is context on at least one side to keep visible;
    // a bare hunk header between two change blocks (`-U0` diffs) is emitted as-is.
    const collapsible = afterChange && gapHunk !== "" && middleTotal > 0 && (trailing.length > 0 || leading.length > 0);
    for (let index = 0; index < keptTrailing; index += 1) rows.push(trailing[index]!);
    if (collapsible) {
      const anchor = hunkAnchor(gapHunk);
      const midShown = Math.min(middleTotal, revealed.get(anchor) ?? 0);
      for (let index = 0; index < midShown; index += 1) rows.push(middle[index]!);
      if (midShown < middleTotal) {
        rows.push({ kind: "expander", anchor, revealed: midShown, hidden: middleTotal - midShown, total: middleTotal });
      }
    } else {
      for (const line of middle) rows.push(line);
    }
    for (let index = leading.length - keptLeading; index < leading.length; index += 1) rows.push(leading[index]!);
    trailing.length = 0;
    leading.length = 0;
    gapHunk = "";
    afterChange = false;
  };

  for (const line of parsed) {
    if (line.kind === "context") {
      // Context before the gap's hunk header is trailing; after it, leading.
      if (gapHunk === "") trailing.push(line);
      else leading.push(line);
      continue;
    }
    if (line.kind === "hunk") {
      // A consecutive hunk (e.g. `-U0` diffs) ends the previous gap first so
      // each header is emitted on its own; nothing to collapse without context.
      if (gapHunk !== "" && trailing.length === 0 && leading.length === 0) {
        rows.push({ kind: "hunk", text: gapHunk });
        gapHunk = "";
        afterChange = false;
      }
      gapHunk = line.text;
      continue;
    }
    // Change line: flush any pending gap, then emit the change.
    flushGap();
    rows.push(line);
    afterChange = true;
    if (line.kind === "header") afterChange = false;
  }
  flushGap();
  return rows;
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

/**
 * Pair two sequences positionally, padding with `null` on the shorter side.
 * Shared by the intra-line word diff (removes vs adds) and the split-view
 * renderer (old column vs new column) so the pairing shape lives in one place.
 */
export function pairByIndex<T>(left: readonly T[], right: readonly T[]): readonly (readonly [T | null, T | null])[] {
  const count = Math.max(left.length, right.length);
  const pairs: [T | null, T | null][] = [];
  for (let index = 0; index < count; index += 1) {
    pairs.push([left[index] ?? null, right[index] ?? null]);
  }
  return pairs;
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
      for (const [removedIndex, addedIndex] of pairByIndex(blockRemoves, blockAdds)) {
        const removed = removedIndex !== null ? lines[removedIndex] : undefined;
        const added = addedIndex !== null ? lines[addedIndex] : undefined;
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

