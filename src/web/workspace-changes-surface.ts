import { createElement, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitDiffResult } from "../domain/git.ts";
import { buildDiffRows, DEFAULT_EXPAND_STEP, pairByIndex, parseUnifiedDiff, type DiffLine, type DiffRow, type ExpanderRow } from "./workspace-diff.ts";
import { t, tCount } from "./workspace-i18n.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";
import { workspaceCountBadge, workspaceEmptyState, workspaceFilterChip, workspaceListDetail, workspaceNotice, workspaceSurfaceHeader } from "./workspace-primitives.ts";

export interface WorkspaceChangesRemote {
  readonly gitStatus: () => Promise<RemoteResult<readonly GitChange[]>>;
  readonly gitDiff: (path?: string) => Promise<RemoteResult<GitDiffResult>>;
}

export interface WorkspaceChangesSurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceChangesRemote | undefined;
  readonly remote?: WorkspaceChangesRemote;
  /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
  readonly refreshMs?: number;
  /** Carrier width in px for the split-view breakpoint; tests inject it (browser uses ResizeObserver). */
  readonly carrierWidth?: number;
  /** Which carrier this surface lives in; the unified/split preference is remembered per carrier. */
  readonly carrier?: string;
}

const statusLabels: Record<GitChange["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  untracked: "??",
  typechange: "T",
  unmerged: "U",
};

type ChangeFilter = "all" | "added" | "modified" | "deleted" | "untracked" | "staged";

const filterLabels: readonly { readonly key: ChangeFilter; readonly label: () => string }[] = [
  { key: "all", label: () => t("changes.filter.all") },
  { key: "added", label: () => t("changes.filter.added") },
  { key: "modified", label: () => t("changes.filter.modified") },
  { key: "deleted", label: () => t("changes.filter.deleted") },
  { key: "untracked", label: () => t("changes.filter.untracked") },
  { key: "staged", label: () => t("changes.filter.staged") },
];

/** Split view appears only on carriers at least this wide (VS Code-style auto-degradation). */
export const SPLIT_BREAKPOINT = 900;

type DiffMode = "unified" | "split";

/** Session-scoped view-mode preference, remembered per carrier (never written to durable Memory). */
const modeStore = new Map<string, DiffMode>();

function matchesFilter(change: GitChange, filter: ChangeFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "staged": return change.staged;
    case "added": return change.status === "added";
    case "modified": return change.status === "modified";
    case "deleted": return change.status === "deleted";
    case "untracked": return change.status === "untracked";
  }
}

function statusText(status: GitChange["status"], staged: boolean): string {
  const label = statusLabels[status];
  if (status === "untracked") return t("changes.status.untracked");
  return `${staged ? t("changes.status.index") : t("changes.status.worktree")} ${label}`;
}

function renderDiffContent(line: DiffLine): ReactNode {
  // Intra-line token segments (equal/added/removed) drive word-level
  // highlighting. When the Operational Budget guard disabled them (tokens is
  // undefined) or a line has no segments, fall back to the plain line text.
  if ((line.kind === "add" || line.kind === "remove") && line.tokens && line.tokens.length > 0) {
    return line.tokens.map((token, index) => createElement("span", {
      key: index,
      "data-dsh-workspace": "diff-token",
      "data-token": token.kind,
    }, token.text));
  }
  return line.text;
}

/** Old/new line numbers plus the (token-aware) line text — the shared cell body. */
function diffLineCells(line: DiffLine): ReactNode {
  return [
    createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.oldLine !== undefined ? String(line.oldLine) : ""),
    createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.newLine !== undefined ? String(line.newLine) : ""),
    createElement("span", { "data-dsh-workspace": "diff-line-text" }, renderDiffContent(line)),
  ];
}

function expanderRow(row: ExpanderRow, onExpand: (anchor: string, total: number, revealed: number) => void, key: number): ReactNode {
  return createElement(
    "div",
    { key, "data-dsh-workspace": "diff-expander", "data-anchor": row.anchor },
    createElement(
      "button",
      { type: "button", onClick: () => onExpand(row.anchor, row.total, row.revealed) },
      `Show ${row.hidden} ${row.hidden === 1 ? t("changes.hiddenLine", { count: row.hidden }) : t("changes.hiddenLines", { count: row.hidden })}`,
    ),
  );
}

function unifiedRows(rows: readonly DiffRow[], onExpand: (anchor: string, total: number, revealed: number) => void): ReactNode {
  return createElement(
    "div",
    { "data-dsh-workspace": "diff-lines" },
    rows.map((row, index) => row.kind === "expander"
      ? expanderRow(row, onExpand, index)
      : createElement(
        "div",
        { key: index, "data-dsh-workspace": "diff-code-line", "data-kind": row.kind },
        diffLineCells(row),
      )),
  );
}

type SplitItem =
  | { readonly kind: "full"; readonly row: DiffRow }
  | { readonly kind: "pair"; readonly old: DiffLine | null; readonly new: DiffLine | null };

/**
 * Pair slots only ever receive add/remove/context lines (expanders and hunks
 * go full-width), so narrowing from `DiffRow` to `DiffLine` is safe here.
 */
function asDiffLine(row: DiffRow): DiffLine {
  return row as DiffLine;
}

/** Pair removes with adds positionally within each change block for split view. */
function splitRows(rows: readonly DiffRow[]): SplitItem[] {
  const items: SplitItem[] = [];
  let block: DiffRow[] = [];
  const flushBlock = (): void => {
    if (block.length === 0) return;
    const removes = block.filter((row) => row.kind === "remove");
    const adds = block.filter((row) => row.kind === "add");
    for (const [removed, added] of pairByIndex(removes, adds)) {
      items.push({ kind: "pair", old: removed ? asDiffLine(removed) : null, new: added ? asDiffLine(added) : null });
    }
    block = [];
  };
  for (const row of rows) {
    if (row.kind === "add" || row.kind === "remove") {
      block.push(row);
      continue;
    }
    flushBlock();
    if (row.kind === "context") items.push({ kind: "pair", old: asDiffLine(row), new: asDiffLine(row) });
    else items.push({ kind: "full", row });
  }
  flushBlock();
  return items;
}

function splitCells(item: SplitItem, onExpand: (anchor: string, total: number, revealed: number) => void, key: number): ReactNode {
  if (item.kind === "full") {
    const row = item.row;
    if (row.kind === "expander") return expanderRow(row, onExpand, key);
    return createElement(
      "div",
      { key, "data-dsh-workspace": "diff-code-line", "data-kind": row.kind, "data-split": "full" },
      createElement("div", { "data-dsh-workspace": "diff-cell", "data-side": "old", "data-kind": row.kind }, diffLineCells(row)),
    );
  }
  const oldLine = item.old;
  const newLine = item.new;
  const kind = oldLine && newLine ? "pair" : oldLine ? "remove" : "add";
  return createElement(
    "div",
    { key, "data-dsh-workspace": "diff-code-line", "data-kind": kind, "data-split": "true" },
    createElement(
      "div",
      { "data-dsh-workspace": "diff-cell", "data-side": "old", ...(oldLine ? { "data-kind": oldLine.kind } : { "data-empty": "true" }) },
      oldLine ? diffLineCells(oldLine) : createElement("span", null, ""),
    ),
    createElement(
      "div",
      { "data-dsh-workspace": "diff-cell", "data-side": "new", ...(newLine ? { "data-kind": newLine.kind } : { "data-empty": "true" }) },
      newLine ? diffLineCells(newLine) : createElement("span", null, ""),
    ),
  );
}

function splitRowsNode(rows: readonly DiffRow[], onExpand: (anchor: string, total: number, revealed: number) => void): ReactNode {
  return createElement(
    "div",
    { "data-dsh-workspace": "diff-split" },
    splitRows(rows).map((item, index) => splitCells(item, onExpand, index)),
  );
}

/** One change row (badge + select button + meta), shared by every group. */
function changeRow(
  change: GitChange,
  state: { readonly selectedPath?: string; readonly selectedButton: React.MutableRefObject<HTMLButtonElement | null>; readonly select: (path: string) => void },
): ReactNode {
  return createElement("li", {
    key: `${change.staged ? "i" : "w"}:${change.path}`,
    "data-dsh-workspace": "change-item",
    "data-selected": String(change.path === state.selectedPath),
    "data-status": change.status,
  },
    createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "change-status-badge", "data-status": change.status }, statusLabels[change.status]),
    createElement("button", {
      ref: change.path === state.selectedPath ? state.selectedButton : undefined,
      type: "button",
      "data-dsh-workspace": "change-select",
      "aria-pressed": change.path === state.selectedPath,
      onClick: () => state.select(change.path),
    }, change.path),
    createElement("span", { "data-dsh-workspace": "change-meta" }, `${statusText(change.status, change.staged)}${change.previousPath ? ` (from ${change.previousPath})` : ""}`),
  );
}

/** One grouped section (Staged / Unstaged / Untracked) with a header and rows. */
function changeGroupSection(
  label: string,
  rows: readonly GitChange[],
  state: { readonly selectedPath?: string; readonly selectedButton: React.MutableRefObject<HTMLButtonElement | null>; readonly select: (path: string) => void },
): ReactNode | null {
  if (rows.length === 0) return null;
  return createElement(
    "section",
    { key: label, "data-dsh-workspace": "change-group", "aria-label": label },
    createElement("h4", { "data-dsh-workspace": "change-group-title" }, label),
    createElement("ul", { "data-dsh-workspace": "changes-list" }, rows.map((change) => changeRow(change, state))),
  );
}

/**
 * Render the visible changes grouped by Staged / Unstaged / Untracked
 * (dsh-web-ui ScmPanel grouping, read-only adaptation — ADR #115). When a
 * non-"all" filter is active, only the matching group(s) are shown.
 */
function changeGroups(
  visible: readonly GitChange[],
  filter: ChangeFilter,
  state: { readonly selectedPath?: string; readonly selectedButton: React.MutableRefObject<HTMLButtonElement | null>; readonly select: (path: string) => void },
): ReactNode {
  const staged = visible.filter((change) => change.staged);
  const untracked = visible.filter((change) => !change.staged && change.status === "untracked");
  const unstaged = visible.filter((change) => !change.staged && change.status !== "untracked");
  if (filter === "staged") {
    return changeGroupSection(t("changes.group.staged"), staged, state) ?? workspaceEmptyState(t("changes.noFiltered", { filter: t("changes.filter.staged").toLowerCase() }));
  }
  if (filter === "untracked") {
    return changeGroupSection(t("changes.group.untracked"), untracked, state) ?? workspaceEmptyState(t("changes.noFiltered", { filter: t("changes.filter.untracked").toLowerCase() }));
  }
  return createElement("div", { "data-dsh-workspace": "change-groups" },
    changeGroupSection(t("changes.group.staged"), staged, state),
    changeGroupSection(t("changes.group.unstaged"), unstaged, state),
    changeGroupSection(t("changes.group.untracked"), untracked, state),
  );
}

/** Read-only Changes view: git status list + readable unified diff preview. */
export function createWorkspaceChangesSurfaceComponent(
  remote: WorkspaceChangesRemote | undefined,
  options: WorkspaceChangesSurfaceOptions = {},
): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceChangesSurface(props: Record<string, unknown>): ReactNode {
    const useSessions = props.useSessions as ((selector: (state: { readonly current?: string }) => string | undefined) => string | undefined) | undefined;
    const sessionId = useSessions?.((state) => state.current);
    const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
    const carrier = options.carrier ?? "tab";
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [changes, setChanges] = useState<readonly GitChange[]>([]);
    const [selectedPath, setSelectedPath] = useState<string | undefined>();
    const [diff, setDiff] = useState<GitDiffResult | undefined>();
    const [diffStatus, setDiffStatus] = useState<"idle" | "loading" | "error">("idle");
    const [filter, setFilter] = useState<ChangeFilter>("all");
    const [refreshTick, setRefreshTick] = useState(0);
    // Bumped on every status poll tick and on manual refresh; the diff effect
    // depends on it so the 5s poll also re-fetches the selected diff (the
    // silent-update / "New changes" pill paths are driven by real polling).
    const [diffTick, setDiffTick] = useState(0);
    const [message, setMessage] = useState<string | undefined>();
    const [revealed, setRevealed] = useState<ReadonlyMap<string, number>>(new Map());
    const [fileCollapsed, setFileCollapsed] = useState(false);
    const [width, setWidth] = useState<number | undefined>(options.carrierWidth);
    const [modeOverride, setModeOverride] = useState<DiffMode | undefined>(() => modeStore.get(carrier));
    const [pendingDiff, setPendingDiff] = useState<GitDiffResult | undefined>();
    const [stale, setStale] = useState(false);
    const request = useRef(0);
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const lastPathRef = useRef<string | undefined>();
    const renderedRef = useRef<{ readonly path: string; readonly key: string } | undefined>();
    const detailRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
      let active = true;
      if (!activeRemote) {
        setStatus("degraded");
        setMessage(t("changes.unavailable"));
        return () => { active = false; };
      }
      if (!sessionId) {
        // Without an active session the surface renders a static notice; do
        // not start the polling timer (avoids leaked intervals in tests).
        setStatus("degraded");
        return () => { active = false; };
      }
      const load = async (): Promise<void> => {
        const token = ++request.current;
        try {
          const value = unwrapRemote(await activeRemote.gitStatus());
          if (!active || token !== request.current) return;
          setChanges(value);
          setSelectedPath((current) => current && value.some((c) => c.path === current) ? current : value[0]?.path);
          setStatus("ready");
          setMessage(undefined);
        } catch (error) {
          if (!active || token !== request.current) return;
          setStatus("degraded");
          setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.unavailable")));
        }
      };
      void load();
      const refreshMs = options.refreshMs ?? 5_000;
      const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => { void load(); setDiffTick((tick) => tick + 1); }, refreshMs) : undefined;
      return () => { active = false; request.current += 1; if (timer !== undefined) clearInterval(timer); };
    }, [activeRemote, refreshTick]);

    // Observe the carrier width so the split toggle can auto-degrade below the
    // breakpoint. Tests inject `carrierWidth` and skip the observer entirely.
    useEffect(() => {
      if (options.carrierWidth !== undefined) return;
      const element = detailRef.current;
      if (!element || typeof ResizeObserver !== "function") return;
      const observer = new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect?.width;
        if (next !== undefined) setWidth(Math.round(next));
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!selectedPath || !activeRemote) return;
      const token = ++request.current;
      const isNewPath = lastPathRef.current !== selectedPath;
      lastPathRef.current = selectedPath;
      if (isNewPath) {
        setDiffStatus("loading");
        setDiff(undefined);
        setStale(false);
        setPendingDiff(undefined);
        setRevealed(new Map());
        setFileCollapsed(false);
      }
      const applyDiffResult = (result: GitDiffResult): void => {
        const key = `${result.staged}\u0000${result.unstaged}`;
        const rendered = renderedRef.current;
        if (rendered && rendered.path === selectedPath) {
          if (rendered.key === key) {
            // Identical content: silent refresh — React reconciles, so scroll
            // position, selection, and collapse state survive untouched.
            setDiff(result);
            setDiffStatus("idle");
            setPendingDiff(undefined);
            setStale(false);
            return;
          }
          // Content changed: do not reflow under the reader; stash behind a pill.
          setPendingDiff(result);
          setStale(true);
          setDiffStatus("idle");
          return;
        }
        // First render for this path.
        renderedRef.current = { path: selectedPath, key };
        setDiff(result);
        setDiffStatus("idle");
        setPendingDiff(undefined);
        setStale(false);
      };
      activeRemote.gitDiff(selectedPath).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) { setDiffStatus("error"); setMessage(friendlyRemoteMessage(result.error.code, t("changes.diffUnavailable"))); return; }
        applyDiffResult(result.value);
        setMessage(undefined);
      }).catch((error) => { if (token === request.current) { setDiffStatus("error"); setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.diffUnavailable"))); } });
    }, [selectedPath, activeRemote, refreshTick, diffTick]);

    useEffect(() => {
      if (selectedPath) selectedButton.current?.focus();
    }, [selectedPath]);

    const select = (path: string): void => setSelectedPath(path);
    const refresh = (): void => { setRefreshTick((tick) => tick + 1); setDiffTick((tick) => tick + 1); };

    const copyDiff = async (): Promise<void> => {
      if (!diff) return;
      if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
        setMessage(t("changes.copyUnavailable"));
        return;
      }
      const text = [diff.staged, diff.unstaged].filter(Boolean).join("\n");
      if (!text) { setMessage(t("changes.noDiffText")); return; }
      try {
        await navigator.clipboard.writeText(text);
        setMessage(t("changes.copyCopied"));
      } catch {
        setMessage(t("changes.copyFailed"));
      }
    };

    const visible = changes.filter((change) => matchesFilter(change, filter));
    const selected = changes.find((change) => change.path === selectedPath);
    const selectedIsUntracked = selected?.status === "untracked";
    // Parse each diff section once per render; the surface needs the typed
    // lines for rendering and the stats for the header.
    const stagedDiff = diff ? parseUnifiedDiff(diff.staged) : undefined;
    const unstagedDiff = diff ? parseUnifiedDiff(diff.unstaged) : undefined;
    const stagedRows = stagedDiff ? buildDiffRows(stagedDiff.lines, revealed) : undefined;
    const unstagedRows = unstagedDiff ? buildDiffRows(unstagedDiff.lines, revealed) : undefined;
    const diffInsertions = (stagedDiff?.insertions ?? 0) + (unstagedDiff?.insertions ?? 0);
    const diffDeletions = (stagedDiff?.deletions ?? 0) + (unstagedDiff?.deletions ?? 0);

    const navigate = (delta: number): void => {
      if (visible.length < 2) return;
      const index = visible.findIndex((change) => change.path === selectedPath);
      const next = index === -1 ? 0 : (index + delta + visible.length) % visible.length;
      select(visible[next]!.path);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
      if (event.key !== "[" && event.key !== "]") return;
      if (visible.length < 2) return;
      event.preventDefault();
      navigate(event.key === "]" ? 1 : -1);
    };

    const expand = (anchor: string, total: number, revealed: number): void => {
      setRevealed((previous) => new Map(previous).set(anchor, Math.min(total, revealed + DEFAULT_EXPAND_STEP)));
    };

    // Below the breakpoint the diff is FORCED unified — a remembered split
    // preference must not survive a narrowing carrier (the toggle disappears,
    // so the user would have no way back).
    const wideEnough = width !== undefined && width >= SPLIT_BREAKPOINT;
    const effectiveMode: DiffMode = width !== undefined && width < SPLIT_BREAKPOINT
      ? "unified"
      : modeOverride ?? (wideEnough ? "split" : "unified");
    const setMode = (mode: DiffMode): void => {
      modeStore.set(carrier, mode);
      setModeOverride(mode);
    };

    const applyPending = (): void => {
      if (!pendingDiff || !selectedPath) return;
      const key = `${pendingDiff.staged}\u0000${pendingDiff.unstaged}`;
      renderedRef.current = { path: selectedPath, key };
      setDiff(pendingDiff);
      setPendingDiff(undefined);
      setStale(false);
    };

    const diffHeader = (): ReactNode => createElement(
      "div",
      { "data-dsh-workspace": "diff-file-header" },
      createElement("button", {
        type: "button",
        "data-dsh-workspace": "diff-collapse",
        "aria-expanded": String(!fileCollapsed),
        "aria-label": fileCollapsed ? t("changes.expandDiff") : t("changes.collapseDiff"),
        onClick: () => setFileCollapsed((value) => !value),
      }, fileCollapsed ? "▸" : "▾"),
      createElement("div", { "data-dsh-workspace": "diff-file-title" },
        createElement("h3", null, selectedPath),
        createElement("span", { "data-dsh-workspace": "diff-stats" },
          createElement("b", { "data-sign": "add" }, `+${diffInsertions}`),
          " ",
          createElement("b", { "data-sign": "del" }, `−${diffDeletions}`),
        ),
      ),
      wideEnough && createElement("div", { role: "group", "aria-label": t("changes.diffMode"), "data-dsh-workspace": "diff-mode-toggle" },
        createElement("button", { type: "button", "aria-pressed": effectiveMode === "unified", onClick: () => setMode("unified") }, t("changes.unified")),
        createElement("button", { type: "button", "aria-pressed": effectiveMode === "split", onClick: () => setMode("split") }, t("changes.split")),
      ),
      createElement("button", { type: "button", "data-dsh-workspace": "diff-prev", "aria-label": t("changes.previousFile"), disabled: visible.length < 2, onClick: () => navigate(-1) }, "‹"),
      createElement("button", { type: "button", "data-dsh-workspace": "diff-next", "aria-label": t("changes.nextFile"), disabled: visible.length < 2, onClick: () => navigate(1) }, "›"),
      createElement("button", { type: "button", onClick: () => { void copyDiff(); } }, t("changes.copyDiff")),
    );

    const renderDiffBlock = (label: string, rows: readonly DiffRow[] | undefined): ReactNode => {
      if (!rows || rows.length === 0) return null;
      return createElement("section", { "aria-label": label, "data-dsh-workspace": "diff-block" },
        createElement("h4", null, label),
        createElement(
          "pre",
          { "data-dsh-workspace": "diff-code", ...(effectiveMode === "split" ? { "data-mode": "split" } : {}) },
          effectiveMode === "split" ? splitRowsNode(rows, expand) : unifiedRows(rows, expand),
        ),
      );
    };

    const body = status === "loading"
      ? createElement("p", { role: "status" }, t("changes.loading"))
      : status === "degraded"
        ? workspaceNotice("error", message ?? t("changes.unavailable"))
        : createElement("div", { "data-dsh-workspace": "changes-surface" },
          workspaceSurfaceHeader({
            title: t("changes.title"),
            count: workspaceCountBadge(changes.length === 1 ? t("changes.count", { count: 1 }) : t("changes.countPlural", { count: changes.length })),
            actions: createElement("button", { type: "button", onClick: refresh }, t("refresh")),
          }),
          changes.length === 0 && workspaceEmptyState(t("changes.empty")),
          changes.length > 0 && workspaceListDetail(
            createElement("div", { "data-dsh-workspace": "changes-list-column" },
              createElement("div", { role: "group", "aria-label": t("changes.filter"), "data-dsh-workspace": "changes-filter" },
                filterLabels.map(({ key, label }) => workspaceFilterChip(label(), filter === key, () => setFilter(key), key)),
              ),
              visible.length > 0
                ? changeGroups(visible, filter, { selectedPath, selectedButton, select })
                : workspaceEmptyState(t("changes.noFiltered", { filter: (filterLabels.find((f) => f.key === filter)?.label() ?? "").toLowerCase() })),
            ),
            createElement("div", { ref: detailRef, "data-dsh-workspace": "changes-detail-column" },
              !selectedPath && workspaceEmptyState(t("changes.selectHint")),
              selectedPath && diffStatus === "loading" && createElement("p", { role: "status" }, t("changes.loadingDiff")),
              selectedPath && diffStatus === "error" && workspaceNotice("error", t("changes.diffUnavailable")),
              selectedPath && diff && createElement("article", { "aria-label": `${selectedPath} diff`, "data-dsh-workspace": "change-diff" },
                diffHeader(),
                stale && createElement("button", { type: "button", "data-dsh-workspace": "diff-refresh-pill", onClick: applyPending }, t("changes.newChanges")),
                diff.truncated && workspaceNotice("warning", t("changes.diffTruncated")),
                selectedIsUntracked && workspaceNotice("info", t("changes.untrackedNotice")),
                fileCollapsed
                  ? workspaceEmptyState(t("changes.diffCollapsed"))
                  : createElement("div", null,
                    !selectedIsUntracked && diff.staged && renderDiffBlock(t("changes.staged"), stagedRows),
                    !selectedIsUntracked && diff.unstaged && renderDiffBlock(t("changes.unstaged"), unstagedRows),
                    !selectedIsUntracked && !diff.staged && !diff.unstaged && createElement("p", { role: "status" }, t("changes.noDiffContent")),
                  ),
              ),
            ),
          ),
          message && createElement("p", { role: "status" }, message),
        );
    if (!sessionId) {
      return createElement("section", { tabIndex: -1, "data-dsh-workspace": "changes", role: "region", "aria-label": t("changes.title"), onKeyDown },
        createElement("h2", null, t("changes.title")),
        createElement("p", { role: "status" }, t("changes.requireSession")));
    }
    return createElement("section", { tabIndex: -1, "data-dsh-workspace": "changes", role: "region", "aria-label": t("changes.title"), onKeyDown }, createElement("h2", null, t("changes.title")), body);
  };
}

export type { GitDiffResult };
export type { ChangeFilter };
export { matchesFilter };
