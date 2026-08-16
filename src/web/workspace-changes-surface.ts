import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitDiffResult } from "../domain/git.ts";
import { parseUnifiedDiff, type DiffLine } from "./workspace-diff.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";
import { workspaceCountBadge, workspaceEmptyState, workspaceFilterChip, workspaceNotice, workspaceSurfaceHeader } from "./workspace-primitives.ts";

export interface WorkspaceChangesRemote {
  readonly gitStatus: () => Promise<RemoteResult<readonly GitChange[]>>;
  readonly gitDiff: (path?: string) => Promise<RemoteResult<GitDiffResult>>;
}

export interface WorkspaceChangesSurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceChangesRemote | undefined;
  readonly remote?: WorkspaceChangesRemote;
  /** Polling cadence in ms; 0 disables auto-refresh (used by tests). */
  readonly refreshMs?: number;
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

const statusNames: Record<GitChange["status"], string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  copied: "Copied",
  untracked: "Untracked",
  typechange: "Type change",
  unmerged: "Unmerged",
};

type ChangeFilter = "all" | "added" | "modified" | "deleted" | "untracked" | "staged";

const filterLabels: readonly { readonly key: ChangeFilter; readonly label: string }[] = [
  { key: "all", label: "All" },
  { key: "added", label: "Added" },
  { key: "modified", label: "Modified" },
  { key: "deleted", label: "Deleted" },
  { key: "untracked", label: "Untracked" },
  { key: "staged", label: "Staged" },
];

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
  return status === "untracked" ? "Untracked" : `${staged ? "Index" : "Worktree"} ${label}`;
}

function diffLines(parsed: readonly DiffLine[]): ReactNode {
  return createElement(
    "div",
    { "data-dsh-workspace": "diff-lines" },
    parsed.map((line, index) => createElement(
      "div",
      { key: index, "data-dsh-workspace": "diff-code-line", "data-kind": line.kind },
      createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.oldLine !== undefined ? String(line.oldLine) : ""),
      createElement("span", { "data-dsh-workspace": "diff-line-num" }, line.newLine !== undefined ? String(line.newLine) : ""),
      createElement("span", { "data-dsh-workspace": "diff-line-text" }, line.text),
    )),
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
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [changes, setChanges] = useState<readonly GitChange[]>([]);
    const [selectedPath, setSelectedPath] = useState<string | undefined>();
    const [diff, setDiff] = useState<GitDiffResult | undefined>();
    const [diffStatus, setDiffStatus] = useState<"idle" | "loading" | "error">("idle");
    const [filter, setFilter] = useState<ChangeFilter>("all");
    const [refreshTick, setRefreshTick] = useState(0);
    const [message, setMessage] = useState<string | undefined>();
    const request = useRef(0);
    const selectedButton = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      let active = true;
      if (!activeRemote) {
        setStatus("degraded");
        setMessage("Git changes are unavailable in this Web scope.");
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
          setMessage(friendlyRemoteMessage(remoteCode(error), "Git changes are unavailable."));
        }
      };
      void load();
      const refreshMs = options.refreshMs ?? 5_000;
      const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => { void load(); }, refreshMs) : undefined;
      return () => { active = false; request.current += 1; if (timer !== undefined) clearInterval(timer); };
    }, [activeRemote, refreshTick]);

    useEffect(() => {
      if (!selectedPath || !activeRemote) return;
      const token = ++request.current;
      setDiffStatus("loading");
      setDiff(undefined);
      activeRemote.gitDiff(selectedPath).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) { setDiffStatus("error"); setMessage("Diff is unavailable for this change."); return; }
        setDiff(result.value);
        setDiffStatus("idle");
        setMessage(undefined);
      }).catch(() => { if (token === request.current) setDiffStatus("error"); });
    }, [selectedPath, activeRemote]);

    useEffect(() => {
      if (selectedPath) selectedButton.current?.focus();
    }, [selectedPath]);

    const select = (path: string): void => setSelectedPath(path);
    const refresh = (): void => setRefreshTick((tick) => tick + 1);

    const copyDiff = async (): Promise<void> => {
      if (!diff) return;
      if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
        setMessage("Copy is unavailable in this browser; select the diff text manually.");
        return;
      }
      const text = [diff.staged, diff.unstaged].filter(Boolean).join("\n");
      if (!text) { setMessage("There is no diff text to copy."); return; }
      try {
        await navigator.clipboard.writeText(text);
        setMessage("Diff copied to the clipboard.");
      } catch {
        setMessage("Copy failed; select the diff text manually.");
      }
    };

    const visible = changes.filter((change) => matchesFilter(change, filter));
    const selected = changes.find((change) => change.path === selectedPath);
    const selectedIsUntracked = selected?.status === "untracked";

    const body = status === "loading"
      ? createElement("p", { role: "status" }, "Loading git changes…")
      : status === "degraded"
        ? workspaceNotice("warning", message ?? "Git changes are unavailable.")
        : createElement("div", { "data-dsh-workspace": "changes-surface" },
          workspaceSurfaceHeader({
            title: "Changes",
            count: workspaceCountBadge(`${changes.length} change${changes.length === 1 ? "" : "s"}`),
            actions: createElement("button", { type: "button", onClick: refresh }, "Refresh"),
          }),
          changes.length === 0 && workspaceEmptyState("No changes in the working tree."),
          changes.length > 0 && createElement("div", { role: "group", "aria-label": "Filter changes", "data-dsh-workspace": "changes-filter" },
            filterLabels.map(({ key, label }) => workspaceFilterChip(label, filter === key, () => setFilter(key), key)),
          ),
          visible.length > 0 && createElement("ul", { "aria-label": "Git changes", "data-dsh-workspace": "changes-list" }, visible.map((change) => createElement("li", {
            key: `${change.staged ? "i" : "w"}:${change.path}`,
            "data-dsh-workspace": "change-item",
            "data-selected": String(change.path === selectedPath),
            "data-status": change.status,
          },
            createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "change-status-badge", "data-status": change.status }, statusLabels[change.status]),
            createElement("button", {
              ref: change.path === selectedPath ? selectedButton : undefined,
              type: "button",
              "data-dsh-workspace": "change-select",
              "aria-pressed": change.path === selectedPath,
              onClick: () => select(change.path),
            }, change.path),
            createElement("span", { "data-dsh-workspace": "change-meta" }, `${statusText(change.status, change.staged)}${change.previousPath ? ` (from ${change.previousPath})` : ""}`),
          ))),
          changes.length > 0 && visible.length === 0 && workspaceEmptyState(`No ${filterLabels.find((f) => f.key === filter)?.label.toLowerCase() ?? ""} changes in this view.`),
          selectedPath && diffStatus === "loading" && createElement("p", { role: "status" }, "Loading diff…"),
          selectedPath && diffStatus === "error" && workspaceNotice("error", "Diff is unavailable for this change."),
          selectedPath && diff && createElement("article", { "aria-label": `${selectedPath} diff`, "data-dsh-workspace": "change-diff" },
            createElement("div", { "data-dsh-workspace": "surface-header" },
              createElement("div", { "data-dsh-workspace": "surface-title" },
                createElement("h3", null, selectedPath),
                selected && createElement("span", { "data-dsh-workspace": "diff-stats" },
                  createElement("b", { "data-sign": "add" }, `+${diffLinesCount(diff.staged).insertions + diffLinesCount(diff.unstaged).insertions}`),
                  " ",
                  createElement("b", { "data-sign": "del" }, `−${diffLinesCount(diff.staged).deletions + diffLinesCount(diff.unstaged).deletions}`),
                ),
              ),
              createElement("div", { "data-dsh-workspace": "surface-actions" },
                createElement("button", { type: "button", onClick: () => { void copyDiff(); } }, "Copy diff"),
              ),
            ),
            diff.truncated && workspaceNotice("warning", "Diff truncated; additional content omitted."),
            selectedIsUntracked && workspaceNotice("info", "Untracked file — stage it to see a diff."),
            !selectedIsUntracked && diff.staged && createElement("section", { "aria-label": "Staged diff", "data-dsh-workspace": "diff-block" },
              createElement("h4", null, "Staged"),
              createElement("pre", { "data-dsh-workspace": "diff-code" }, diffLines(parseUnifiedDiff(diff.staged).lines)),
            ),
            !selectedIsUntracked && diff.unstaged && createElement("section", { "aria-label": "Unstaged diff", "data-dsh-workspace": "diff-block" },
              createElement("h4", null, "Unstaged"),
              createElement("pre", { "data-dsh-workspace": "diff-code" }, diffLines(parseUnifiedDiff(diff.unstaged).lines)),
            ),
            !selectedIsUntracked && !diff.staged && !diff.unstaged && createElement("p", { role: "status" }, "No diff content for this change."),
          ),
          message && createElement("p", { role: "status" }, message),
        );
    if (!sessionId) {
      return createElement("section", { "data-dsh-workspace": "changes", role: "region", "aria-label": "Git changes" },
        createElement("h2", null, "Git changes"),
        createElement("p", { role: "status" }, "Git changes require an active Harness session."));
    }
    return createElement("section", { "data-dsh-workspace": "changes", role: "region", "aria-label": "Git changes" }, createElement("h2", null, "Git changes"), body);
  };
}

function diffLinesCount(diffText: string): { readonly insertions: number; readonly deletions: number } {
  const parsed = parseUnifiedDiff(diffText);
  return { insertions: parsed.insertions, deletions: parsed.deletions };
}

export type { GitDiffResult };
