import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { WorkspaceSummaryData } from "../host/workspace-summary.ts";
import { t } from "./workspace-i18n.ts";
import { workspaceEmptyState } from "./workspace-primitives.ts";
import { friendlyRemoteMessage, remoteCode } from "./workspace-remote.ts";

export interface WorkspaceSummaryRemote {
  /**
   * Derive the current session summary (unwrapped value; undefined when the
   * session has no usable Workspace). v0.6 derives on demand from durable
   * tool records instead of a persisted custom event.
   */
  readonly workspaceSummary: () => Promise<WorkspaceSummaryData | undefined>;
}

export interface WorkspaceSummaryBlockOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceSummaryRemote | undefined;
  readonly remote?: WorkspaceSummaryRemote;
  readonly refreshMs?: number;
}

/** Compact human-readable session activity span derived from host timestamps. */
function formatActiveSpan(firstObservedAt: number, lastObservedAt: number): string {
  if (!firstObservedAt || !lastObservedAt || lastObservedAt <= firstObservedAt) return t("summary.justNow");
  const seconds = Math.round((lastObservedAt - firstObservedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/**
 * Read-only summary block rendered at the top of the Workspace conversation
 * tab. The data is derived on demand by the host from allow-listed durable
 * tool records (tool/call + tool/result) — never from a persisted custom
 * event — so it works identically for live and resumed sessions (the
 * history-resume fix, wayfinder #112).
 */
export function workspaceSummaryBlockComponent(options: WorkspaceSummaryBlockOptions = {}): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceSummaryBlock(props: Record<string, unknown>): ReactNode {
    const useSessions = props.useSessions as ((selector: (state: { readonly current?: string }) => string | undefined) => string | undefined) | undefined;
    const sessionId = useSessions?.((state) => state.current);
    const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : options.remote;
    const [summary, setSummary] = useState<WorkspaceSummaryData | undefined>();
    const [message, setMessage] = useState<string | undefined>();
    const [loaded, setLoaded] = useState(false);
    const request = useRef(0);

    useEffect(() => {
      let active = true;
      if (!activeRemote || !sessionId) {
        setLoaded(true);
        setSummary(undefined);
        return () => { active = false; };
      }
      const load = async (): Promise<void> => {
        const token = ++request.current;
        try {
          const value = await activeRemote.workspaceSummary();
          if (!active || token !== request.current) return;
          setSummary(value);
          setMessage(undefined);
        } catch (error) {
          if (!active || token !== request.current) return;
          setMessage(friendlyRemoteMessage(remoteCode(error), t("summary.unavailable")));
        } finally {
          if (active && token === request.current) setLoaded(true);
        }
      };
      void load();
      const refreshMs = options.refreshMs ?? 5_000;
      const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => { void load(); }, refreshMs) : undefined;
      return () => { active = false; request.current += 1; if (timer !== undefined) clearInterval(timer); };
    }, [activeRemote, sessionId, options.refreshMs]);

    if (!sessionId || !loaded) return null;
    if (!summary) return null;

    const span = formatActiveSpan(summary.firstObservedAt, summary.lastObservedAt);
    return createElement(
      "section",
      { "data-dsh-workspace": "summary-block", "aria-label": t("view.workspace") },
      createElement("div", { "data-dsh-workspace": "summary-block-body" },
        createElement("strong", null, summary.workspaceName),
        createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.files", { count: summary.filesTouched })),
        createElement("span", { "data-dsh-workspace": "summary-metric" }, `${summary.filesCreated} ${t("changes.filter.added").toLowerCase()} · ${summary.filesModified} ${t("changes.filter.modified").toLowerCase()} · ${summary.filesDeleted} ${t("changes.filter.deleted").toLowerCase()}`),
        createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.artifacts", { count: summary.artifacts })),
        summary.memoryCount > 0 && createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.memory", { count: summary.memoryCount, count2: summary.decisionCount })),
        createElement("span", { "data-dsh-workspace": "summary-metric" }, t("summary.active", { span })),
      ),
      message && workspaceEmptyState(message),
    );
  };
}

/** Re-export the pure span formatter for tests. */
export { formatActiveSpan };
