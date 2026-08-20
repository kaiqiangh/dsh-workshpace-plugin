import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitRepoInfo } from "../domain/git.ts";
import { createWorkspaceHistorySurfaceComponent, type WorkspaceHistoryRemote } from "./workspace-history-surface.ts";
import { createWorkspaceChangesSurfaceComponent, type WorkspaceChangesRemote } from "./workspace-changes-surface.ts";
import { t, useWorkspaceLocale } from "./workspace-i18n.ts";
import { workspaceEmptyState, workspaceNotice } from "./workspace-primitives.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";

/** Reserved for shared host-rendering primitives; v0.8 renders Changes and History in the tab. */
export interface WorkspaceGitPrimitives {
  // No members required for v0.8 — kept so the surface signature can grow.
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
   * standalone Changes surface.
   */
  readonly carrierWidth?: number;
  /** Carrier identity used to remember the diff mode. */
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
  const changesBySession = new Map<string, WorkspaceChangesRemote>();
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
  const changesComponent = createWorkspaceChangesSurfaceComponent(undefined, {
    resolveRemote: (sessionId) => {
      const active = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
      if (!active) return undefined;
      const key = sessionId ?? "";
      let narrowed = changesBySession.get(key);
      if (!narrowed) {
        narrowed = active;
        changesBySession.set(key, narrowed);
      }
      return narrowed;
    },
    refreshMs: options.refreshMs,
    carrierWidth: options.carrierWidth,
    carrier: options.carrier,
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
            const value = unwrapRemote(await activeRemote.gitStatus());
            if (!active || token !== request.current) return;
            const staged = value.filter((change) => change.staged).length;
            const untracked = value.filter((change) => !change.staged && change.status === "untracked").length;
            setCounts({ staged, untracked, unstaged: value.length - staged - untracked });
          } catch (error) {
            if (!active || token !== request.current) return;
            setCounts({ staged: 0, unstaged: 0, untracked: 0 });
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

    const richChangesPane = createElement("div", { "data-dsh-workspace": "git-changes" }, createElement(changesComponent, props));

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
            createElement("div", { "data-dsh-workspace": "git-pane", "data-dsh-workspace-pane": "changes", hidden: pane !== "changes" }, richChangesPane),
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
