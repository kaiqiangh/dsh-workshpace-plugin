import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import { GIT_HISTORY_MAX_COMMITS, type GitCommit, type GitCommitResult, type GitHistoryOptions } from "../domain/git.ts";
import { parseUnifiedDiff, type DiffLine } from "./workspace-diff.ts";
import { t, useWorkspaceLocale } from "./workspace-i18n.ts";
import { workspaceEmptyState, workspaceListDetail, workspaceNotice, workspaceSurfaceHeader } from "./workspace-primitives.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";

export interface WorkspaceHistoryRemote {
  readonly gitHistory: (options?: GitHistoryOptions) => Promise<RemoteResult<readonly GitCommit[]>>;
  readonly gitCommit: (sha: string) => Promise<RemoteResult<GitCommitResult>>;
}

export interface WorkspaceHistorySurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceHistoryRemote | undefined;
  readonly remote?: WorkspaceHistoryRemote;
  /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
  readonly refreshMs?: number;
}

/** Relative commit age (mirrors the summary span formatter's compact style). */
function formatRelativeTime(epochSeconds: number): string {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - (Number(epochSeconds) || 0)));
  if (seconds < 60) return t("summary.justNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Deterministic (UTC) absolute timestamp for the commit summary block. */
function formatAbsoluteTime(epochSeconds: number): string {
  const date = new Date((Number(epochSeconds) || 0) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").slice(0, 16);
}

/** Split one combined `git show` diff into per-file sections at `diff --git` boundaries. */
export function splitDiffByFile(diff: string): readonly string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of String(diff ?? "").split("\n")) {
    if (line.startsWith("diff --git ") && current.length > 0) {
      chunks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks.filter((chunk) => chunk.trim().length > 0);
}

/** New-path side of a `diff --git a/old b/new` header (quotes stripped). */
export function diffHeaderPath(line: string): string | undefined {
  const match = /^diff --git a\/.+\s+b\/.+$/u.test(line) ? /^diff --git a\/(.+) b\/(.+)$/u.exec(line) : undefined;
  if (!match) return undefined;
  return (match[2] ?? "").replace(/^"|"$/gu, "");
}

/** Intra-line token segments when available, else the plain line text. */
function renderDiffText(line: DiffLine): ReactNode {
  if ((line.kind === "add" || line.kind === "remove") && line.tokens && line.tokens.length > 0) {
    return line.tokens.map((token, index) => createElement("span", {
      key: index,
      "data-dsh-workspace": "diff-token",
      "data-token": token.kind,
    }, token.text));
  }
  return line.text;
}

/** Unified diff rows with old/new line numbers, reusing the shared diff vocabulary. */
function diffLinesNode(lines: readonly DiffLine[]): ReactNode {
  return createElement("div", { "data-dsh-workspace": "diff-lines" },
    lines.map((line, index) => createElement(
      "div",
      { key: index, "data-dsh-workspace": "diff-code-line", "data-kind": line.kind },
      createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.oldLine !== undefined ? String(line.oldLine) : ""),
      createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.newLine !== undefined ? String(line.newLine) : ""),
      createElement("span", { "data-dsh-workspace": "diff-line-text" }, renderDiffText(line)),
    )));
}

function fileDiffBlock(chunk: string, fallbackPath: string | undefined, key: number): ReactNode {
  const parsed = parseUnifiedDiff(chunk);
  const header = parsed.lines.find((line) => line.kind === "header" && line.text.startsWith("diff --git "));
  const path = header ? diffHeaderPath(header.text) : fallbackPath;
  return createElement(
    "section",
    { key, "data-dsh-workspace": "history-diff-file", "aria-label": path ?? "diff" },
    createElement("div", { "data-dsh-workspace": "history-diff-file-header" },
      createElement("span", { "data-dsh-workspace": "history-diff-file-path" }, path ?? ""),
      createElement("span", { "data-dsh-workspace": "diff-stats" },
        createElement("b", { "data-sign": "add" }, `+${parsed.insertions}`),
        " ",
        createElement("b", { "data-sign": "del" }, `−${parsed.deletions}`),
      ),
    ),
    parsed.lines.length > 0
      ? createElement("pre", { "data-dsh-workspace": "diff-code" }, diffLinesNode(parsed.lines))
      : createElement("p", { role: "status" }, t("changes.noDiffContent")),
  );
}

function kvRow(label: string, value: string, key?: string): ReactNode {
  return createElement("div", { key, "data-dsh-workspace": "history-kv" },
    createElement("dt", null, label),
    createElement("dd", null, value || "—"),
  );
}

/** Full selected-commit detail: summary block + files-changed + per-file diffs. */
function renderCommitDetail(result: GitCommitResult): ReactNode {
  const commit = result.commit;
  const files = result.files ?? [];
  const chunks = splitDiffByFile(result.diff);
  return createElement(
    "article",
    { "aria-label": t("history.commitDetail"), "data-dsh-workspace": "history-commit-detail" },
    createElement("div", { "data-dsh-workspace": "history-commit-summary" },
      createElement("h3", { "data-dsh-workspace": "history-commit-subject" }, commit.subject),
      createElement("div", { "data-dsh-workspace": "history-commit-hash" }, commit.sha),
      commit.decorations && createElement("div", { "data-dsh-workspace": "history-commit-deco" }, commit.decorations),
      createElement("dl", { "data-dsh-workspace": "history-kv-list" },
        kvRow(t("history.author"), commit.author),
        kvRow(t("history.commitDetail"), `${formatAbsoluteTime(commit.time)} · ${formatRelativeTime(commit.time)}`),
        kvRow(t("history.parents"), (commit.parents ?? []).join(", ")),
        kvRow(t("history.decorations"), commit.decorations),
      ),
    ),
    result.diffTruncated && workspaceNotice("warning", t("changes.diffTruncated")),
    files.length > 0 && createElement(
      "section",
      { "aria-label": t("history.filesChanged"), "data-dsh-workspace": "history-files" },
      createElement("h4", null, t("history.filesChanged")),
      createElement("ul", { "data-dsh-workspace": "history-file-list" },
        files.map((file, index) => createElement(
          "li",
          { key: `${file.path}\u0000${index}`, "data-dsh-workspace": "history-file" },
          createElement("span", { "data-dsh-workspace": "history-file-path" }, file.path),
          createElement("span", { "data-dsh-workspace": "diff-stats" },
            createElement("b", { "data-sign": "add", "aria-label": t("history.additions", { count: file.additions }) }, `+${file.additions}`),
            " ",
            createElement("b", { "data-sign": "del", "aria-label": t("history.deletions", { count: file.deletions }) }, `−${file.deletions}`),
          ),
        ))),
    ),
    chunks.length > 0 && createElement("section", { "aria-label": t("history.commitDetail"), "data-dsh-workspace": "history-diff-files" },
      chunks.map((chunk, index) => fileDiffBlock(chunk, files[index]?.path, index)),
    ),
  );
}

/** A reserved horizontal bar above the commit list for the future branch graph (v0.8). */
function graphBar(commits: readonly GitCommit[]): ReactNode {
  const first = commits[0];
  const label = first?.decorations || (first ? first.sha.slice(0, 7) : "");
  return createElement("div", { "data-dsh-workspace": "history-graph-bar", "aria-hidden": "true" }, `* ${label}`);
}

function commitRow(commit: GitCommit, selected: boolean, onSelect: (sha: string) => void): ReactNode {
  return createElement(
    "li",
    { key: commit.sha, "data-dsh-workspace": "history-commit", "data-selected": String(selected) },
    createElement("button", {
      type: "button",
      "data-dsh-workspace": "history-commit-select",
      "aria-pressed": selected,
      onClick: () => onSelect(commit.sha),
    },
      createElement("span", { "data-dsh-workspace": "history-commit-hash" }, commit.sha.slice(0, 7)),
      createElement("span", { "data-dsh-workspace": "history-commit-subject" }, commit.subject),
      commit.decorations ? createElement("span", { "data-dsh-workspace": "history-commit-deco" }, commit.decorations) : null,
    ),
    createElement("span", { "data-dsh-workspace": "history-commit-meta" }, `${commit.author} · ${formatRelativeTime(commit.time)}`),
  );
}

/**
 * Read-only commit history: commit list (left) + selected-commit summary and
 * per-file unified diff (right). The list reserves a placeholder strip at its
 * top for the v0.8 branch graph; v0.7 renders plain commit rows only.
 */
export function createWorkspaceHistorySurfaceComponent(
  remote: WorkspaceHistoryRemote | undefined,
  options: WorkspaceHistorySurfaceOptions = {},
): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceHistorySurface(props: Record<string, unknown>): ReactNode {
    const useSessions = props.useSessions as ((selector: (state: { readonly current?: string }) => string | undefined) => string | undefined) | undefined;
    const sessionId = useSessions?.((state) => state.current);
    const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [commits, setCommits] = useState<readonly GitCommit[]>([]);
    const [selectedSha, setSelectedSha] = useState<string | undefined>();
    const [detail, setDetail] = useState<GitCommitResult | undefined>();
    const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");
    const [message, setMessage] = useState<string | undefined>();
    const [refreshTick, setRefreshTick] = useState(0);
    const request = useRef(0);
    // Re-render on locale change so labels and relative times follow the app language.
    useWorkspaceLocale();

    useEffect(() => {
      let active = true;
      if (!activeRemote) {
        setStatus("degraded");
        setMessage(t("changes.unavailable"));
        return () => { active = false; };
      }
      if (!sessionId) {
        setStatus("degraded");
        return () => { active = false; };
      }
      const load = async (): Promise<void> => {
        const token = ++request.current;
        try {
          const value = unwrapRemote(await activeRemote.gitHistory({ limit: GIT_HISTORY_MAX_COMMITS }));
          if (!active || token !== request.current) return;
          setCommits(value);
          setSelectedSha((current) => current && value.some((commit) => commit.sha === current) ? current : value[0]?.sha);
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
      const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => { void load(); }, refreshMs) : undefined;
      return () => { active = false; request.current += 1; if (timer !== undefined) clearInterval(timer); };
    }, [activeRemote, sessionId, refreshTick]);

    useEffect(() => {
      if (!selectedSha || !activeRemote) return;
      const token = ++request.current;
      setDetailStatus("loading");
      setDetail(undefined);
      activeRemote.gitCommit(selectedSha).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) { setDetailStatus("error"); setMessage(friendlyRemoteMessage(result.error.code, t("changes.diffUnavailable"))); return; }
        setDetail(result.value);
        setDetailStatus("idle");
        setMessage(undefined);
      }).catch((error) => {
        if (token === request.current) { setDetailStatus("error"); setMessage(friendlyRemoteMessage(remoteCode(error), t("changes.diffUnavailable"))); }
      });
    }, [selectedSha, activeRemote, refreshTick]);

    const refresh = (): void => setRefreshTick((tick) => tick + 1);

    const body = status === "loading"
      ? createElement("p", { role: "status" }, t("history.loading"))
      : status === "degraded"
        ? workspaceNotice("error", message ?? t("changes.unavailable"))
        : createElement("div", { "data-dsh-workspace": "history-surface" },
          workspaceSurfaceHeader({
            title: t("history.title"),
            actions: createElement("button", { type: "button", onClick: refresh }, t("refresh")),
          }),
          commits.length === 0 && workspaceEmptyState(t("history.empty")),
          commits.length > 0 && workspaceListDetail(
            createElement("div", { "data-dsh-workspace": "history-list-column" },
              graphBar(commits),
              createElement("ul", { "data-dsh-workspace": "history-commit-list" },
                commits.map((commit) => commitRow(commit, commit.sha === selectedSha, (sha) => setSelectedSha(sha))),
              ),
            ),
            createElement("div", { "data-dsh-workspace": "history-detail-column" },
              !selectedSha && workspaceEmptyState(t("history.selectCommit")),
              selectedSha && detailStatus === "loading" && createElement("p", { role: "status" }, t("changes.loadingDiff")),
              selectedSha && detailStatus === "error" && workspaceNotice("error", t("changes.diffUnavailable")),
              selectedSha && detail && renderCommitDetail(detail),
            ),
          ),
          message && createElement("p", { role: "status" }, message),
        );
    if (!sessionId) {
      return createElement("section", { tabIndex: -1, "data-dsh-workspace": "history", role: "region", "aria-label": t("history.title") },
        createElement("h2", null, t("history.title")),
        createElement("p", { role: "status" }, t("changes.requireSession")));
    }
    return createElement("section", { tabIndex: -1, "data-dsh-workspace": "history", role: "region", "aria-label": t("history.title") },
      createElement("h2", null, t("history.title")), body);
  };
}
