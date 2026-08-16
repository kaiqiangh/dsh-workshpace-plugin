import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { GitChange, GitDiffResult, GitErrorCode } from "../domain/git.ts";

export interface WorkspaceChangesRemote {
  readonly gitStatus: () => Promise<RemoteResult<readonly GitChange[]>>;
  readonly gitDiff: (path?: string) => Promise<RemoteResult<GitDiffResult>>;
}

export interface WorkspaceChangesSurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceChangesRemote | undefined;
  readonly remote?: WorkspaceChangesRemote;
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

function valueOf<T>(result: RemoteResult<T>): T {
  if (result.ok) return result.value;
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

function statusText(status: GitChange["status"], staged: boolean): string {
  const label = statusLabels[status];
  return status === "untracked" ? label : `${staged ? "Index" : "Worktree"} ${label}`;
}

function isGitUnavailable(error: unknown): boolean {
  const code = error instanceof Error ? error.message.split(":")[0] : "";
  return code === "GIT_UNAVAILABLE" || code === "NOT_A_GIT_REPOSITORY";
}

/** Read-only Changes view: git status list + unified diff preview. */
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
      const token = ++request.current;
      void activeRemote.gitStatus().then((result) => {
        if (!active || token !== request.current) return;
        if (!result.ok) {
          setStatus("degraded");
          setMessage(isGitUnavailable(result.error) ? "This workspace is not a git repository (or git is unavailable)." : "Git changes are unavailable.");
          return;
        }
        setChanges(result.value);
        setSelectedPath((current) => current && result.value.some((c) => c.path === current) ? current : result.value[0]?.path);
        setStatus("ready");
        setMessage(undefined);
      }).catch(() => {
        if (!active || token !== request.current) return;
        setStatus("degraded");
        setMessage("Git changes are unavailable.");
      });
      return () => { active = false; request.current += 1; };
    }, [activeRemote]);

    useEffect(() => {
      if (!selectedPath || !activeRemote) return;
      const token = ++request.current;
      setDiffStatus("loading");
      setDiff(undefined);
      void activeRemote.gitDiff(selectedPath).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) { setDiffStatus("error"); return; }
        setDiff(result.value);
        setDiffStatus("idle");
      }).catch(() => { if (token === request.current) setDiffStatus("error"); });
    }, [selectedPath, activeRemote]);

    useEffect(() => {
      if (selectedPath) selectedButton.current?.focus();
    }, [selectedPath]);

    const select = (path: string): void => setSelectedPath(path);

    const body = status === "loading"
      ? createElement("p", { role: "status" }, "Loading git changes…")
      : status === "degraded"
        ? createElement("div", { "data-dsh-workspace": "notice", "data-dsw-tone": "warning" }, createElement("p", { role: "status" }, message ?? "Git changes are unavailable."))
        : createElement("div", { "data-dsh-workspace": "changes-surface" },
          createElement("header", { "data-dsh-workspace": "surface-header" },
            createElement("div", { "data-dsh-workspace": "surface-title" },
              createElement("h3", null, "Changes"),
              createElement("span", { "data-dsh-workspace": "count-badge", "aria-label": "Change count" }, `${changes.length} change${changes.length === 1 ? "" : "s"}`),
            ),
          ),
          changes.length === 0 && createElement("div", { "data-dsh-workspace": "empty-state" }, "No changes in the working tree."),
          changes.length > 0 && createElement("ul", { "aria-label": "Git changes", "data-dsh-workspace": "changes-list" }, changes.map((change) => createElement("li", {
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
          selectedPath && diffStatus === "loading" && createElement("p", { role: "status" }, "Loading diff…"),
          selectedPath && diffStatus === "error" && createElement("div", { "data-dsh-workspace": "notice", "data-dsw-tone": "error" }, createElement("p", { role: "status" }, "Diff is unavailable for this change.")),
          selectedPath && diff && createElement("article", { "aria-label": `${selectedPath} diff`, "data-dsh-workspace": "change-diff" },
            createElement("h3", null, selectedPath),
            diff.truncated && createElement("div", { "data-dsh-workspace": "notice", "data-dsw-tone": "warning" }, createElement("p", { role: "status" }, "Diff truncated; additional content omitted.")),
            diff.staged && createElement("section", { "aria-label": "Staged diff", "data-dsh-workspace": "diff-block" },
              createElement("h4", null, "Staged"),
              createElement("pre", { "data-dsh-workspace": "diff-code" }, diff.staged)),
            diff.unstaged && createElement("section", { "aria-label": "Unstaged diff", "data-dsh-workspace": "diff-block" },
              createElement("h4", null, "Unstaged"),
              createElement("pre", { "data-dsh-workspace": "diff-code" }, diff.unstaged)),
            !diff.staged && !diff.unstaged && createElement("p", { role: "status" }, "No diff content for this change."),
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

export type { GitErrorCode };
