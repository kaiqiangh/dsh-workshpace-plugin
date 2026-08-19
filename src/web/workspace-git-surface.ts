import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitCommit, GitCommitResult, GitDiffResult, GitHistoryOptions, GitRepoInfo } from "../domain/git.ts";
import { createWorkspaceChangesSurfaceComponent, type WorkspaceChangesRemote } from "./workspace-changes-surface.ts";
import { createWorkspaceHistorySurfaceComponent, type WorkspaceHistoryRemote } from "./workspace-history-surface.ts";
import { t, useWorkspaceLocale } from "./workspace-i18n.ts";
import { workspaceEmptyState, workspaceNotice } from "./workspace-primitives.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";

/** Reserved for shared host-rendering primitives; v0.7 embeds the existing Changes surface and the diff parser directly. */
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
  /** Carrier width in px for the embedded Changes split-view breakpoint; tests inject it. */
  readonly carrierWidth?: number;
  /** Which carrier the embedded Changes surface lives in (split-view preference memory). */
  readonly carrier?: string;
}

type GitPane = "changes" | "history";

/** Narrow the full Git remote to the Changes surface seam. */
function changesRemoteFor(remote: WorkspaceGitRemote): WorkspaceChangesRemote {
  return {
    gitStatus: () => remote.gitStatus(),
    gitDiff: (path) => remote.gitDiff(path),
  };
}

/** Narrow the full Git remote to the History surface seam. */
function historyRemoteFor(remote: WorkspaceGitRemote): WorkspaceHistoryRemote {
  return {
    gitHistory: (options) => remote.gitHistory(options),
    gitCommit: (sha) => remote.gitCommit(sha),
  };
}

/**
 * The single Git tab (IA #125): repo status header + an internal
 * Changes/History segmented switch. The Changes pane embeds the existing
 * changes surface; the History pane embeds the commit-history surface. A
 * non-Git workspace renders one centered empty state (no spinner, no error).
 */
export function createWorkspaceGitSurfaceComponent(
  remote: WorkspaceGitRemote | undefined,
  // Reserved for future shared host-rendering primitives; v0.7 renders the
  // Changes and History panes with the existing surface factories.
  primitives: WorkspaceGitPrimitives = {},
  options: WorkspaceGitSurfaceOptions = {},
): (props: Record<string, unknown>) => ReactNode {
  void primitives;
  // The child surfaces treat `resolveRemote` identity as a reload trigger, so
  // the narrowed per-session remotes must be referentially stable (mirrors the
  // client's own per-session remote cache); otherwise every render re-runs the
  // child effects in an infinite loop.
  const changesBySession = new Map<string, WorkspaceChangesRemote>();
  const historyBySession = new Map<string, WorkspaceHistoryRemote>();
  const changesComponent = createWorkspaceChangesSurfaceComponent(undefined, {
    resolveRemote: (sessionId) => {
      const active = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
      if (!active) return undefined;
      const key = sessionId ?? "";
      let narrowed = changesBySession.get(key);
      if (!narrowed) {
        narrowed = changesRemoteFor(active);
        changesBySession.set(key, narrowed);
      }
      return narrowed;
    },
    refreshMs: options.refreshMs,
    carrierWidth: options.carrierWidth,
    carrier: options.carrier ?? "git-changes",
  });
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
    const request = useRef(0);
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
            return;
          }
          setRepoInfo(info);
          setInfoStatus("ready");
          setMessage(undefined);
          try {
            const changes = unwrapRemote(await activeRemote.gitStatus());
            if (!active || token !== request.current) return;
            const staged = changes.filter((change) => change.staged).length;
            const untracked = changes.filter((change) => !change.staged && change.status === "untracked").length;
            setCounts({ staged, untracked, unstaged: changes.length - staged - untracked });
          } catch {
            if (active && token === request.current) setCounts({ staged: 0, unstaged: 0, untracked: 0 });
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

    const refresh = (): void => setRefreshTick((tick) => tick + 1);
    const dirty = counts.staged + counts.unstaged + counts.untracked > 0;

    const repoHeader = createElement("div", { "data-dsh-workspace": "git-repo-header" },
      createElement("span", { "data-dsh-workspace": "git-status-pill" },
        createElement("span", { "data-dsh-workspace": "git-status-dot", "data-state": dirty ? "dirty" : "clean" }),
        createElement("span", { "data-dsh-workspace": "git-status-text" },
          t("git.branch"), " ",
          createElement("b", { "data-dsh-workspace": "git-branch" }, repoInfo?.branch || "—"),
          repoInfo?.head ? createElement("code", { "data-dsh-workspace": "git-head" }, repoInfo.head) : null,
          " · ", dirty ? t("git.dirty") : t("git.clean"),
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
            createElement("div", { "data-dsh-workspace": "git-pane", "data-dsh-workspace-pane": "changes", hidden: pane !== "changes" }, createElement(changesComponent, props)),
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
