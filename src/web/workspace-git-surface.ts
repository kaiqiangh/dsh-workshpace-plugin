import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitDiffResult, GitRepoInfo } from "../domain/git.ts";
import { createWorkspaceHistorySurfaceComponent, type WorkspaceHistoryRemote } from "./workspace-history-surface.ts";
import { matchesFilter, type ChangeFilter, type WorkspaceChangesRemote } from "./workspace-changes-surface.ts";
import { parseUnifiedDiff, type DiffLine } from "./workspace-diff.ts";
import { t, useWorkspaceLocale } from "./workspace-i18n.ts";
import { workspaceEmptyState, workspaceFilterChip, workspaceNotice } from "./workspace-primitives.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";

/** Reserved for shared host-rendering primitives; v0.7 renders the Changes pane and History pane in the tab. */
export interface WorkspaceGitPrimitives {
  // No members required for v0.7 — kept so the surface signature can grow.
}

export interface WorkspaceGitRemote extends WorkspaceChangesRemote, WorkspaceHistoryRemote {
  readonly gitRepoInfo: () => Promise<RemoteResult<GitRepoInfo>>;
}

export interface WorkspaceGitSurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceGitRemote | undefined;
  readonly remote?: WorkspaceGitRemote;
  /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
  readonly refreshMs?: number;
  /**
   * Reserved: carrier width in px for the Changes split-view breakpoint of the
   * standalone Changes surface (the Git tab's compact pane is always unified).
   */
  readonly carrierWidth?: number;
  /** Reserved: which carrier the standalone Changes surface lives in. */
  readonly carrier?: string;
}

type GitPane = "changes" | "history";

/** Narrow the full Git remote to the History surface seam. */
function historyRemoteFor(remote: WorkspaceGitRemote): WorkspaceHistoryRemote {
  return {
    gitHistory: (options) => remote.gitHistory(options),
    gitCommit: (sha) => remote.gitCommit(sha),
  };
}

/** Status letters for the compact Changes pane (untracked renders "U" like the prototype). */
const statusLetters: Record<GitChange["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  untracked: "U",
  typechange: "T",
  unmerged: "U",
};

/** Per-file unified-diff stats (insertions/deletions) used for the `+N -M` signature. */
interface DiffStats {
  readonly add: number;
  readonly del: number;
}

const filterLabels: readonly { readonly key: ChangeFilter; readonly label: () => string }[] = [
  { key: "all", label: () => t("changes.filter.all") },
  { key: "added", label: () => t("changes.filter.added") },
  { key: "modified", label: () => t("changes.filter.modified") },
  { key: "deleted", label: () => t("changes.filter.deleted") },
  { key: "untracked", label: () => t("changes.filter.untracked") },
  { key: "staged", label: () => t("changes.filter.staged") },
];

/**
 * Bounded parallel map: runs `worker` over `items` with at most `concurrency`
 * in-flight promises. Keeps the per-refresh diff-stat fetch from spawning one
 * git subprocess per changed file at once.
 */
async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(runners);
  return results;
}

/** One unified-diff row with a single line-number gutter (adds carry a leading "+"). */
function gitDiffLineNode(line: DiffLine, key: number): ReactNode {
  const number = line.kind === "add"
    ? `+${line.newLine ?? ""}`
    : line.oldLine !== undefined
      ? String(line.oldLine)
      : "";
  let text: ReactNode = line.text;
  if ((line.kind === "add" || line.kind === "remove") && line.tokens && line.tokens.length > 0) {
    text = line.tokens.map((token, index) => createElement("span", { key: index, "data-dsh-workspace": "diff-token", "data-token": token.kind }, token.text));
  }
  return createElement("div", { key, "data-dsh-workspace": "git-diff-line", "data-kind": line.kind },
    createElement("span", { "data-dsh-workspace": "git-diff-num" }, number),
    createElement("span", { "data-dsh-workspace": "git-diff-text" }, text),
  );
}

function statusText(change: GitChange): string {
  if (change.status === "untracked") return t("changes.status.untracked");
  return `${change.staged ? t("changes.status.index") : t("changes.status.worktree")} ${statusLetters[change.status]}`;
}

/** Row signature: `+N -M` from the loaded diff, "new" for untracked, else the status text. */
function signatureFor(change: GitChange, stats: ReadonlyMap<string, DiffStats>): string {
  if (change.status === "untracked") return t("git.sigNew");
  const entry = stats.get(change.path);
  if (entry) return `+${entry.add} -${entry.del}`;
  return statusText(change);
}

function fileRow(
  change: GitChange,
  state: { readonly selectedPath?: string; readonly stats: ReadonlyMap<string, DiffStats>; readonly select: (path: string) => void },
): ReactNode {
  const selected = change.path === state.selectedPath;
  return createElement("li", {
    key: `${change.staged ? "i" : "w"}:${change.path}`,
    "data-dsh-workspace": "git-file-row",
    "data-selected": String(selected),
    "data-status": change.status,
  },
    createElement("span", { "data-dsh-workspace": "git-file-status", "data-status": change.status }, statusLetters[change.status]),
    createElement("button", {
      type: "button",
      "data-dsh-workspace": "git-file-select",
      "aria-pressed": selected,
      title: change.path,
      onClick: () => state.select(change.path),
    }, change.path),
    createElement("span", { "data-dsh-workspace": "git-file-sig" }, signatureFor(change, state.stats)),
  );
}

function fileGroup(
  label: string,
  rows: readonly GitChange[],
  state: { readonly selectedPath?: string; readonly stats: ReadonlyMap<string, DiffStats>; readonly select: (path: string) => void },
): ReactNode | null {
  if (rows.length === 0) return null;
  return createElement("section", { key: label, "data-dsh-workspace": "git-file-group", "aria-label": label },
    createElement("h4", { "data-dsh-workspace": "git-file-group-title" }, label),
    createElement("ul", { "data-dsh-workspace": "git-file-list" }, rows.map((change) => fileRow(change, state))),
  );
}

/**
 * The single Git tab (prototype #124): repo status header + a Changes/History
 * segmented switch. The Changes pane renders filter chips, grouped file rows
 * (status letter + path + `+N -M`), and a unified diff. The History pane embeds
 * the commit-history surface. A non-Git workspace renders one centered empty
 * state (no spinner, no error).
 */
export function createWorkspaceGitSurfaceComponent(
  remote: WorkspaceGitRemote | undefined,
  // Reserved for future shared host-rendering primitives; v0.7 renders the
  // Changes and History panes directly.
  primitives: WorkspaceGitPrimitives = {},
  options: WorkspaceGitSurfaceOptions = {},
): (props: Record<string, unknown>) => ReactNode {
  void primitives;
  // The child History surface treats `resolveRemote` identity as a reload
  // trigger, so the narrowed per-session remote must be referentially stable
  // (mirrors the client's own per-session remote cache); otherwise every render
  // re-runs the child effect in an infinite loop.
  const historyBySession = new Map<string, WorkspaceHistoryRemote>();
  const historyComponent = createWorkspaceHistorySurfaceComponent(undefined, {
    resolveRemote: (sessionId) => {
      const active = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
      if (!active) return undefined;
      const key = sessionId ?? "";
      let narrowed = historyBySession.get(key);
      if (!narrowed) {
        narrowed = historyRemoteFor(active);
        historyBySession.set(key, narrowed);
      }
      return narrowed;
    },
    refreshMs: options.refreshMs,
  });

  return function WorkspaceGitSurface(props: Record<string, unknown>): ReactNode {
    const useSessions = props.useSessions as ((selector: (state: { readonly current?: string }) => string | undefined) => string | undefined) | undefined;
    const sessionId = useSessions?.((state) => state.current);
    const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
    const [infoStatus, setInfoStatus] = useState<"loading" | "ready" | "nongit" | "error">("loading");
    const [repoInfo, setRepoInfo] = useState<GitRepoInfo | undefined>();
    const [counts, setCounts] = useState({ staged: 0, unstaged: 0, untracked: 0 });
    const [message, setMessage] = useState<string | undefined>();
    const [pane, setPane] = useState<GitPane>("changes");
    const [refreshTick, setRefreshTick] = useState(0);
    // Changes pane state.
    const [changesStatus, setChangesStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [changes, setChanges] = useState<readonly GitChange[]>([]);
    const [filter, setFilter] = useState<ChangeFilter>("all");
    const [selectedPath, setSelectedPath] = useState<string | undefined>();
    const [diff, setDiff] = useState<GitDiffResult | undefined>();
    const [diffStatus, setDiffStatus] = useState<"idle" | "loading" | "error">("idle");
    const [statsByPath, setStatsByPath] = useState<ReadonlyMap<string, DiffStats>>(new Map());
    const request = useRef(0);
    const statsRequest = useRef(0);
    const lastPathRef = useRef<string | undefined>(undefined);
    // Re-render on locale change so the header labels follow the app language.
    useWorkspaceLocale();

    useEffect(() => {
      let active = true;
      if (!activeRemote) {
        setInfoStatus("error");
        setMessage(t("changes.unavailable"));
        return () => { active = false; };
      }
      if (!sessionId) {
        setInfoStatus("error");
        return () => { active = false; };
      }
      const load = async (): Promise<void> => {
        const token = ++request.current;
        try {
          const info = unwrapRemote(await activeRemote.gitRepoInfo());
          if (!active || token !== request.current) return;
          if (!info.isGit) {
            // Non-Git workspace: centered empty state, no spinner, no error.
            setRepoInfo(info);
            setInfoStatus("nongit");
            setMessage(undefined);
            setChanges([]);
            setChangesStatus("ready");
            return;
          }
          setRepoInfo(info);
          setInfoStatus("ready");
          setMessage(undefined);
          try {
            const value = unwrapRemote(await activeRemote.gitStatus());
            if (!active || token !== request.current) return;
            setChanges(value);
            setSelectedPath((current) => current && value.some((change) => change.path === current) ? current : value[0]?.path);
            const staged = value.filter((change) => change.staged).length;
            const untracked = value.filter((change) => !change.staged && change.status === "untracked").length;
            setCounts({ staged, untracked, unstaged: value.length - staged - untracked });
            setChangesStatus("ready");
          } catch (error) {
            if (!active || token !== request.current) return;
            setCounts({ staged: 0, unstaged: 0, untracked: 0 });
            setChangesStatus("degraded");
            setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.unavailable")));
          }
        } catch (error) {
          if (!active || token !== request.current) return;
          setInfoStatus("error");
          setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.unavailable")));
        }
      };
      void load();
      const refreshMs = options.refreshMs ?? 5_000;
      const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => { void load(); }, refreshMs) : undefined;
      return () => { active = false; request.current += 1; if (timer !== undefined) clearInterval(timer); };
    }, [activeRemote, sessionId, refreshTick]);

    // Load the selected file's unified diff (staged + unstaged) and fold its
    // stats into the signature map. Re-runs whenever the status poll refreshes
    // `changes` so the diff follows the working tree like the old surface.
    useEffect(() => {
      if (infoStatus !== "ready" || !selectedPath || !activeRemote) return;
      const token = ++request.current;
      const isNewPath = lastPathRef.current !== selectedPath;
      lastPathRef.current = selectedPath;
      // New path: clear the old diff so the loading state shows. Poll refresh
      // of the same path keeps the previous diff visible (stale-while-revalidate).
      if (isNewPath) {
        setDiffStatus("loading");
        setDiff(undefined);
      } else {
        setDiffStatus("loading");
      }
      activeRemote.gitDiff(selectedPath).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) {
          setDiffStatus("error");
          setMessage(friendlyRemoteMessage(result.error.code, t("changes.diffUnavailable")));
          return;
        }
        setDiff(result.value);
        setDiffStatus("idle");
        setStatsByPath((previous) => {
          const staged = parseUnifiedDiff(result.value.staged);
          const unstaged = parseUnifiedDiff(result.value.unstaged);
          const next = new Map(previous);
          next.set(selectedPath, { add: staged.insertions + unstaged.insertions, del: staged.deletions + unstaged.deletions });
          return next;
        });
        setMessage(undefined);
      }).catch((error) => {
        if (token === request.current) {
          setDiffStatus("error");
          setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.diffUnavailable")));
        }
      });
    }, [infoStatus, selectedPath, activeRemote, refreshTick, changes]);

    // Per-file `+N -M` signatures for the visible list. Fetches bounded diffs
    // in parallel (concurrency 4) only while the Changes pane is visible; the
    // selected file is skipped here because the diff effect already loads it.
    useEffect(() => {
      if (infoStatus !== "ready" || pane !== "changes" || changes.length === 0) return;
      let active = true;
      const token = ++statsRequest.current;
      const visible = changes.filter((change) => matchesFilter(change, filter)).slice(0, 40);
      const paths = [...new Set(visible.filter((change) => change.status !== "untracked" && change.path !== selectedPath).map((change) => change.path))];
      if (paths.length === 0) return () => { active = false; };
      void mapWithConcurrency(paths, 4, async (path) => {
        if (!activeRemote) return { path, value: undefined as GitDiffResult | undefined };
        try {
          const result = await activeRemote.gitDiff(path);
          return { path, value: result.ok ? result.value : undefined };
        } catch {
          return { path, value: undefined };
        }
      }).then((entries) => {
        if (!active || token !== statsRequest.current) return;
        setStatsByPath((previous) => {
          const next = new Map(previous);
          for (const entry of entries) {
            if (!entry.value) continue;
            const staged = parseUnifiedDiff(entry.value.staged);
            const unstaged = parseUnifiedDiff(entry.value.unstaged);
            next.set(entry.path, { add: staged.insertions + unstaged.insertions, del: staged.deletions + unstaged.deletions });
          }
          return next;
        });
      });
      return () => { active = false; };
    }, [infoStatus, pane, changes, filter, selectedPath, refreshTick]);

    const refresh = (): void => setRefreshTick((tick) => tick + 1);
    const dirty = counts.staged + counts.unstaged + counts.untracked > 0;

    const repoHeader = createElement("div", { "data-dsh-workspace": "git-repo-header" },
      createElement("span", { "data-dsh-workspace": "git-status-pill" },
        createElement("span", { "data-dsh-workspace": "git-status-dot", "data-state": dirty ? "dirty" : "clean" }),
        createElement("span", { "data-dsh-workspace": "git-status-text" },
          t("git.onBranchPrefix"), " ",
          createElement("b", { "data-dsh-workspace": "git-branch" }, repoInfo?.branch || "—"),
          t("git.onBranchSuffix"), " · ",
          dirty ? t("git.dirty") : t("git.clean"),
        ),
      ),
      createElement("span", { "data-dsh-workspace": "git-ahead-behind" }, `↑${repoInfo?.ahead ?? 0} ↓${repoInfo?.behind ?? 0}`),
      createElement("span", { "data-dsh-workspace": "git-count-pill" }, t("git.staged", { count: counts.staged })),
      createElement("span", { "data-dsh-workspace": "git-count-pill" }, t("git.unstaged", { count: counts.unstaged })),
      createElement("span", { "data-dsh-workspace": "git-count-pill" }, t("git.untracked", { count: counts.untracked })),
      createElement("span", { "data-dsh-workspace": "git-header-spacer" }),
      createElement("button", { type: "button", onClick: refresh }, t("git.refresh")),
    );

    const segment = createElement("div", { role: "group", "aria-label": t("view.git"), "data-dsh-workspace": "git-segment" },
      createElement("button", { type: "button", "aria-pressed": pane === "changes", onClick: () => setPane("changes") }, t("view.changes")),
      createElement("button", { type: "button", "aria-pressed": pane === "history", onClick: () => setPane("history") }, t("view.history")),
    );

    const select = (path: string): void => setSelectedPath(path);
    const visible = changes.filter((change) => matchesFilter(change, filter));
    const stagedGroup = visible.filter((change) => change.staged);
    const untrackedGroup = visible.filter((change) => !change.staged && change.status === "untracked");
    const unstagedGroup = visible.filter((change) => !change.staged && change.status !== "untracked");
    const selected = changes.find((change) => change.path === selectedPath);
    const selectedIsUntracked = selected?.status === "untracked";
    const parsedDiff = diff ? parseUnifiedDiff([diff.staged, diff.unstaged].filter(Boolean).join("\n")) : undefined;
    const rowState = { selectedPath, stats: statsByPath, select };

    const changesPane = createElement("div", { "data-dsh-workspace": "git-changes" },
      changesStatus === "degraded"
        ? workspaceNotice("error", message ?? t("changes.unavailable"))
        : changesStatus === "loading"
          ? createElement("p", { role: "status" }, t("changes.loading"))
          : createElement("div", { "data-dsh-workspace": "git-changes-body" },
            createElement("div", { role: "group", "aria-label": t("changes.filter"), "data-dsh-workspace": "git-changes-filter" },
              filterLabels.map(({ key, label }) => workspaceFilterChip(label(), filter === key, () => setFilter(key), key)),
            ),
            createElement("div", { "data-dsh-workspace": "git-changes-columns" },
              createElement("div", { "data-dsh-workspace": "git-changes-list" },
                changes.length === 0
                  ? workspaceEmptyState(t("changes.empty"))
                  : visible.length === 0
                    ? workspaceEmptyState(t("changes.noFiltered", { filter: (filterLabels.find((f) => f.key === filter)?.label() ?? "").toLowerCase() }))
                    : createElement("div", { "data-dsh-workspace": "git-file-groups" },
                      fileGroup(t("changes.group.staged"), stagedGroup, rowState),
                      fileGroup(t("changes.group.unstaged"), unstagedGroup, rowState),
                      fileGroup(t("changes.group.untracked"), untrackedGroup, rowState),
                    ),
              ),
              createElement("div", { "data-dsh-workspace": "git-changes-detail" },
                !selectedPath && workspaceEmptyState(t("changes.selectHint")),
                selectedPath && diffStatus === "loading" && !diff && createElement("p", { role: "status" }, t("changes.loadingDiff")),
                selectedPath && diffStatus === "error" && workspaceNotice("error", t("changes.diffUnavailable")),
                selectedPath && diff && createElement("article", { "aria-label": `${selectedPath} diff`, "data-dsh-workspace": "git-diff" },
                  createElement("div", { "data-dsh-workspace": "git-diff-header" },
                    createElement("span", { "data-dsh-workspace": "git-file-status", "data-status": selected?.status ?? "modified" }, selected ? statusLetters[selected.status] : "M"),
                    createElement("span", { "data-dsh-workspace": "git-diff-path" }, selectedPath),
                    parsedDiff && createElement("span", { "data-dsh-workspace": "git-diff-stats", "aria-label": `${parsedDiff.insertions} additions, ${parsedDiff.deletions} deletions` }, `+${parsedDiff.insertions} −${parsedDiff.deletions}`),
                    createElement("span", { "data-dsh-workspace": "git-diff-mode" }, t("git.modeUnified")),
                  ),
                  diff.truncated && workspaceNotice("warning", t("changes.diffTruncated")),
                  selectedIsUntracked && workspaceNotice("info", t("changes.untrackedNotice")),
                  parsedDiff && parsedDiff.lines.length > 0
                    ? createElement("pre", { "data-dsh-workspace": "git-diff-code" }, parsedDiff.lines.map((line, index) => gitDiffLineNode(line, index)))
                    : createElement("p", { role: "status" }, t("changes.noDiffContent")),
                ),
              ),
            ),
          ),
    );

    const nonGitState = createElement("div", { "data-dsh-workspace": "git-nongit" },
      workspaceEmptyState(createElement("div", null,
        createElement("p", { "data-dsh-workspace": "git-nongit-title" }, t("git.notARepo")),
        createElement("p", { "data-dsh-workspace": "git-nongit-hint" }, t("git.notARepoHint")),
      )),
    );

    const body = infoStatus === "loading"
      ? createElement("p", { role: "status" }, t("changes.loading"))
      : infoStatus === "error"
        ? workspaceNotice("error", message ?? t("changes.unavailable"))
        : infoStatus === "nongit"
          ? nonGitState
          : createElement("div", { "data-dsh-workspace": "git-surface" },
            repoHeader,
            segment,
            createElement("div", { "data-dsh-workspace": "git-pane", "data-dsh-workspace-pane": "changes", hidden: pane !== "changes" }, changesPane),
            createElement("div", { "data-dsh-workspace": "git-pane", "data-dsh-workspace-pane": "history", hidden: pane !== "history" }, createElement(historyComponent, props)),
            message && createElement("p", { role: "status" }, message),
          );
    if (!sessionId) {
      return createElement("section", { tabIndex: -1, "data-dsh-workspace": "git", role: "region", "aria-label": t("view.git") },
        createElement("h2", null, t("view.git")),
        createElement("p", { role: "status" }, t("changes.requireSession")));
    }
    return createElement("section", { tabIndex: -1, "data-dsh-workspace": "git", role: "region", "aria-label": t("view.git") },
      createElement("h2", null, t("view.git")), body);
  };
}
