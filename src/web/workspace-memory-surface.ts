import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type {
  MemoryDraft,
  MemoryGovernance,
  MemoryListOptions,
  MemoryReadState,
  MemoryRecord,
  MemorySearchOptions,
  MemoryScopeRequest,
  MemoryStatus,
  MemoryType,
} from "../types.ts";
import { MEMORY_TYPES } from "../types.ts";
import type { MemoryGovernanceAction } from "../domain/memory-governance.ts";
import { remoteErrorMessage, unwrapRemote } from "./workspace-remote.ts";
import { workspaceCountBadge, workspaceEmptyState, workspaceListDetail, workspaceNotice } from "./workspace-primitives.ts";
import { t } from "./workspace-i18n.ts";

export interface WorkspaceMemoryRemote {
  readonly memoryOpen: (request: MemoryScopeRequest) => Promise<RemoteResult<MemoryReadState>>;
  readonly memoryList: (request: MemoryScopeRequest, options?: MemoryListOptions) => Promise<RemoteResult<readonly MemoryRecord[]>>;
  readonly memorySearch: (request: MemoryScopeRequest, query: string, options?: MemorySearchOptions) => Promise<RemoteResult<readonly MemoryRecord[]>>;
  readonly memoryUpsert: (request: MemoryScopeRequest, draft: MemoryDraft) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryArchive: (request: MemoryScopeRequest, id: string, expectedRevision: number, expectedHash: string) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryForget: (request: MemoryScopeRequest, id: string, expectedRevision: number, expectedHash: string) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryGovern: (request: MemoryScopeRequest, id: string, action: MemoryGovernanceAction, expectedRevision: number, expectedHash: string) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryExport: (request: MemoryScopeRequest) => Promise<RemoteResult<string>>;
  readonly memoryImport: (request: MemoryScopeRequest, serialized: string) => Promise<RemoteResult<readonly MemoryRecord[]>>;
  readonly memoryMarkUsed?: (request: MemoryScopeRequest, id: string) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryClose?: (request: MemoryScopeRequest) => Promise<RemoteResult<void>>;
}

export interface WorkspaceMemorySurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceMemoryRemote | undefined;
  readonly remote?: WorkspaceMemoryRemote;
}

export const workspaceMemoryTypes: readonly MemoryType[] = MEMORY_TYPES;

export function workspaceMemoryRequest(scope: MemoryScopeRequest["scope"], userId: string, sharedProject = false): MemoryScopeRequest {
  if (scope === "user") return { scope, userId: userId.trim() || "default" };
  return scope === "shared-project" ? { scope, sharedProject: true } : { scope };
}

export function workspaceMemoryRecordSummary(record: MemoryRecord): string {
  const provenance = record.provenance.sessionId ? `${record.provenance.kind}/${record.provenance.sessionId}` : record.provenance.kind;
  return `${record.scope} · ${record.type} · ${provenance} · ${record.contentHash.slice(0, 15)} · updated ${record.updatedAt} · last-used ${record.lastUsedAt ?? "never"} · used ${record.useCount}`;
}

function valueOf<T>(result: RemoteResult<T>): T {
  return unwrapRemote(result);
}

function errorMessage(error: unknown, fallback = t("memory.operationFailed")): string {
  return remoteErrorMessage(error, fallback);
}

function scopeLabel(scope: MemoryScopeRequest["scope"]): string {
  return scope === "shared-project" ? t("memory.scope.sharedProject") : t(`memory.scope.${scope}`);
}

function displayGovernance(record: MemoryRecord): MemoryGovernance {
  if (record.governance) return record.governance;
  const userAuthored = record.provenance.kind === "user";
  return {
    origin: userAuthored ? "user-authored" : record.provenance.kind === "import" ? "imported" : "derived",
    sourceRefs: userAuthored ? [] : [{ kind: record.provenance.kind === "import" ? "import" : "session", id: record.provenance.sessionId ?? record.id }],
    verification: userAuthored ? "verified" : "unverified",
    ...(userAuthored ? { verifiedAt: record.updatedAt, verifiedBy: "user" as const } : {}),
    revision: 1,
    retention: record.scope === "session" ? "session-end" : record.scope === "user" ? "user-managed" : "project-delete",
  };
}

/** Review-only Memory surface. It never calls Agent, followup, or prompt/context APIs. */
export function createWorkspaceMemorySurfaceComponent(options: WorkspaceMemorySurfaceOptions = {}): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceMemorySurface(props: Record<string, unknown>): ReactNode {
    const useSessions = props.useSessions as ((selector: (state: { readonly current?: string }) => string | undefined) => string | undefined) | undefined;
    const sessionId = useSessions?.((state) => state.current);
    const remote = options.resolveRemote ? options.resolveRemote(sessionId) : options.remote;
    const [scope, setScope] = useState<MemoryScopeRequest["scope"]>("project");
    const [userId, setUserId] = useState("default");
    const [sharedProject, setSharedProject] = useState(false);
    const [sharedWriteAcknowledged, setSharedWriteAcknowledged] = useState(false);
    const [state, setState] = useState<MemoryReadState | undefined>();
    const [records, setRecords] = useState<readonly MemoryRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [query, setQuery] = useState("");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState<MemoryType>("fact");
    const [filterType, setFilterType] = useState<MemoryType | "">("");
    const [statusFilter, setStatusFilter] = useState<MemoryStatus>("active");
    const [forgetPending, setForgetPending] = useState(false);
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [message, setMessage] = useState<string | undefined>();
    const requestToken = useRef(0);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const scopeFirstButton = useRef<HTMLButtonElement | null>(null);
    const forgetTrigger = useRef<HTMLButtonElement | null>(null);
    const confirmButton = useRef<HTMLButtonElement | null>(null);
    const requestBase = workspaceMemoryRequest(scope, userId, sharedProject);
    const request: MemoryScopeRequest = scope === "shared-project" ? { ...requestBase, sharedWriteAcknowledged } : requestBase;
    const selected = records.find((record) => record.id === selectedId);
    const selectedGovernance = selected && displayGovernance(selected);
    const conflictingRecords = selected === undefined ? [] : records.filter((record) => record.id !== selected.id && record.type === selected.type && record.title.trim().toLocaleLowerCase() === selected.title.trim().toLocaleLowerCase() && record.contentHash !== selected.contentHash);
    const hasConflict = conflictingRecords.length > 0;
    const writesAllowed = scope !== "shared-project" || sharedWriteAcknowledged;

    const load = async (text = query): Promise<void> => {
      const token = ++requestToken.current;
      if (!remote) {
        setStatus("degraded");
        setMessage(t("memory.unavailable"));
        return;
      }
      try {
        const opened = valueOf(await remote.memoryOpen(request));
        const filters = { limit: 100, status: statusFilter, ...(filterType ? { type: filterType } : {}) };
        const next = text.trim() ? valueOf(await remote.memorySearch(request, text, filters)) : valueOf(await remote.memoryList(request, filters));
        if (token !== requestToken.current) return;
        setState(opened);
        setRecords(next);
        setSelectedId((current) => current && next.some((record) => record.id === current) ? current : next[0]?.id);
        setStatus("ready");
        setMessage(opened.readOnly ? t("memory.newerSchema") : opened.warnings.length ? `${opened.warnings.length} ${t("memory.warnings")}` : undefined);
      } catch (error) {
        if (token !== requestToken.current) return;
        setStatus("degraded");
        setMessage(errorMessage(error));
      }
    };

    useEffect(() => {
      requestToken.current += 1;
      setState(undefined);
      setRecords([]);
      setSelectedId(undefined);
      setSharedWriteAcknowledged(false);
      setTitle("");
      setContent("");
      void load("");
      return () => { requestToken.current += 1; };
    }, [remote, request.scope, request.userId, request.sharedProject, filterType, statusFilter]);

    useEffect(() => { selectedButton.current?.focus(); }, [selectedId]);

    useEffect(() => {
      if (!selected) return;
      setTitle(selected.title);
      setContent(selected.content);
      setType(selected.type);
    }, [selectedId]);

    // Best-effort last-used update: viewing an existing record refreshes its
    // useCount/lastUsedAt through the optional memoryMarkUsed seam. Failures
    // (e.g. unacknowledged Shared Project writes) are silent; this is a stat.
    const markedUsed = useRef<string | undefined>(undefined);
    useEffect(() => {
      if (!remote?.memoryMarkUsed || !selected || state?.readOnly) return;
      if (markedUsed.current === selected.id) return;
      markedUsed.current = selected.id;
      void remote.memoryMarkUsed(request, selected.id).catch(() => { /* best-effort */ });
    }, [remote, selectedId, state?.readOnly]);

    // Release the session-scoped store when the session/remote changes and on
    // unmount, so stores do not accumulate for dead sessions. The request is
    // captured per remote, so switching sessions closes the previous one.
    const closeRequest = useRef<{ readonly remote?: WorkspaceMemoryRemote; readonly request: MemoryScopeRequest } | undefined>(undefined);
    useEffect(() => {
      const previous = closeRequest.current;
      closeRequest.current = { remote, request };
      if (previous && previous.remote !== remote && previous.remote?.memoryClose) {
        void previous.remote.memoryClose(previous.request).catch(() => { /* best-effort */ });
      }
      return () => {
        if (remote?.memoryClose && closeRequest.current?.remote === remote) {
          void remote.memoryClose(closeRequest.current.request).catch(() => { /* best-effort */ });
          closeRequest.current = undefined;
        }
      };
    }, [remote]);

    const save = async (): Promise<void> => {
      if (!remote || !state) return;
      try {
      if (!writesAllowed) { setMessage(t("memory.sharedWriteAck")); return; }
      const draft: MemoryDraft = { scope: state.scope, scopeKey: state.scopeKey, type, title, content, tags: selected?.tags ?? [], provenance: { kind: "user" }, ...(selected ? { id: selected.id, expectedRevision: selectedGovernance?.revision ?? 1, expectedHash: selected.contentHash } : {}) };
        valueOf(await remote.memoryUpsert(request, draft));
        await load("");
        setMessage(t("memory.saved"));
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const mutate = async (operation: "archive" | "forget" | "verify" | "reverify" | "pin" | "unpin" | "restore" | "reject"): Promise<void> => {
      if (!remote || !selected) return;
      if (!writesAllowed) { setMessage(t("memory.sharedWriteAck")); return; }
      try {
        valueOf(await remote.memoryGovern(request, selected.id, operation, selectedGovernance?.revision ?? 1, selected.contentHash));
        setSelectedId(undefined);
        setTitle("");
        setContent("");
        await load("");
        if (operation === "forget") setTimeout(() => scopeFirstButton.current?.focus(), 0);
        const labels: Record<typeof operation, string> = { archive: t("memory.archived"), forget: t("memory.forgotten"), verify: t("memory.verified"), reverify: t("memory.reverified"), pin: t("memory.pinned"), unpin: t("memory.unpinned"), restore: t("memory.restored"), reject: t("memory.rejected") };
        setMessage(`${t("memory.title")} ${labels[operation]} ${t("memory.locally")}`);
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const resolveConflict = async (): Promise<void> => {
      if (!remote || !selected || !hasConflict || !writesAllowed) return;
      try {
        if (selectedGovernance?.verification === "unverified") valueOf(await remote.memoryGovern(request, selected.id, "verify", selectedGovernance.revision, selected.contentHash));
        for (const conflict of conflictingRecords) {
          const governance = displayGovernance(conflict);
          if (governance.verification === "unverified") valueOf(await remote.memoryGovern(request, conflict.id, "reject", governance.revision, conflict.contentHash));
          else if (conflict.status === "active") valueOf(await remote.memoryGovern(request, conflict.id, "archive", governance.revision, conflict.contentHash));
        }
        await load("");
        setMessage(t("memory.keptVersion"));
      } catch (error) { setMessage(errorMessage(error)); }
    };

    useEffect(() => {
      if (forgetPending) confirmButton.current?.focus();
    }, [forgetPending]);

    const exportMemory = async (): Promise<void> => {
      if (!remote) return;
      try {
        const serialized = valueOf(await remote.memoryExport(request));
        const url = globalThis.URL?.createObjectURL?.(new Blob([serialized], { type: "application/json" }));
        if (url && typeof document !== "undefined") {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "dsh-memory-export.json";
          anchor.click();
          globalThis.URL.revokeObjectURL(url);
        }
        setMessage(t("memory.exportReady", { bytes: serialized.length }));
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const importMemory = async (event: { target: { files?: readonly { size?: number; text: () => Promise<string> }[] } }): Promise<void> => {
      const file = event.target.files?.[0];
      if (!remote || !file) return;
      try {
        if (!writesAllowed) throw new Error(t("memory.sharedWriteAck"));
        if (file.size !== undefined && file.size > 8 * 1024 * 1024) throw new Error(t("memory.importSizeLimit"));
        const imported = valueOf(await remote.memoryImport(request, await file.text()));
        await load("");
        setMessage(t("memory.imported", { count: imported.length }));
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const scopeButtons = createElement("div", { "data-dsw-segment": "true", role: "group", "aria-label": t("memory.scope") }, (["project", "session", "user", "shared-project"] as const).map((value) => createElement("button", {
      key: value,
      ref: value === "project" ? scopeFirstButton : undefined,
      type: "button",
      "aria-pressed": scope === value,
      onClick: () => { setScope(value); setSharedProject(value === "shared-project"); setSharedWriteAcknowledged(false); },
    }, scopeLabel(value))));
    const recordList = createElement("ul", { "aria-label": t("memory.records"), "data-dsh-workspace": "memory-list" }, records.map((record) => {
      const governance = displayGovernance(record);
      return createElement("li", { key: record.id, "data-dsh-workspace": "memory-card", "data-selected": String(record.id === selectedId) },
        createElement("div", { "data-dsh-workspace": "memory-card-header" },
          createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "memory-badge" }, record.type),
          createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "memory-badge", "data-dsh-workspace-verification": governance.verification }, governance.verification),
          governance.origin === "model-suggested" && createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "memory-badge", "data-dsh-workspace-proposal": "true" }, t("memory.proposal")),
          createElement("button", { ref: record.id === selectedId ? selectedButton : undefined, type: "button", "data-dsh-workspace": "memory-select", "aria-pressed": record.id === selectedId, onClick: () => setSelectedId(record.id) }, record.title),
        ),
        createElement("span", { "data-dsh-workspace": "memory-meta" }, `${workspaceMemoryRecordSummary(record)}${record.status !== "active" ? ` · ${record.status}` : ""}`),
        createElement("span", { "data-dsh-workspace": "memory-preview" }, record.content.slice(0, 96)),
      );
    }));
    const editor = createElement("details", { "data-dsh-workspace": "memory-editor" },
      createElement("summary", null, selected ? `${t("memory.edit")} ${selected.title}` : t("memory.create")),
      createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); void save(); }, "aria-label": selected ? t("memory.edit") : t("memory.create") },
        createElement("label", null, `${t("memory.titleField")} `, createElement("input", { value: title, maxLength: 256, onChange: (event: { target: { value: string } }) => setTitle(event.target.value) })),
        createElement("label", null, `${t("memory.typeField")} `, createElement("select", { value: type, onChange: (event: { target: { value: MemoryType } }) => setType(event.target.value) }, workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value)))),
        createElement("label", null, `${t("memory.contentField")} `, createElement("textarea", { value: content, maxLength: 64 * 1024, onChange: (event: { target: { value: string } }) => setContent(event.target.value) })),
        createElement("div", { "data-dsw-editor-actions": "true" },
          createElement("button", { type: "submit", "data-dsw-primary": "true", disabled: !state || state.readOnly || !writesAllowed }, selected ? t("memory.saveChanges") : t("memory.save")),
          selected && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("archive") }, t("memory.archive")),
          selected && createElement("button", { ref: forgetTrigger, type: "button", disabled: !writesAllowed, onClick: () => setForgetPending(true) }, t("memory.forget")),
          selected?.status === "archived" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("restore") }, t("memory.restore")),
          selectedGovernance?.verification === "unverified" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("verify") }, t("memory.verify")),
          selectedGovernance?.verification === "unverified" && hasConflict && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("reject") }, t("memory.reject")),
          selectedGovernance?.verification === "stale" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("reverify") }, t("memory.reverify")),
          selectedGovernance?.verification === "verified" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate(selectedGovernance.pinnedAt === undefined ? "pin" : "unpin") }, selectedGovernance.pinnedAt === undefined ? t("memory.pin") : t("memory.unpin")),
        ),
      ),
    );
    const body = status === "loading"
      ? createElement("p", { role: "status" }, t("memory.loading"))
      : status === "degraded"
        ? workspaceNotice("error", message ?? t("memory.unavailable"))
        : createElement("div", { "data-dsh-workspace": "memory-surface" },
          createElement("div", { "data-dsh-workspace": "memory-toolbar" },
            createElement("div", { "data-dsw-row": "true" },
              scopeButtons,
              scope === "shared-project" && createElement("label", null, createElement("input", { type: "checkbox", checked: sharedWriteAcknowledged, onChange: (event: { target: { checked: boolean } }) => setSharedWriteAcknowledged(event.target.checked) }), t("memory.ackSharedWrite")),
              scope === "user" && createElement("label", null, `${t("memory.userProfile")} `, createElement("input", { value: userId, onChange: (event: { target: { value: string } }) => setUserId(event.target.value), "aria-label": t("memory.userProfile") })),
            ),
            createElement("div", { "data-dsw-row": "true" },
              createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); if (searchTimer.current) clearTimeout(searchTimer.current); void load(query); } }, createElement("label", null, `${t("memory.searchLabel")} `, createElement("input", { value: query, onChange: (event: { target: { value: string } }) => { setQuery(event.target.value); if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => { void load(event.target.value); }, 250); }, "aria-label": t("memory.searchLabel") })), createElement("button", { type: "submit" }, t("search"))),
              createElement("label", null, `${t("memory.typeFilter")} `, createElement("select", { value: filterType, onChange: (event: { target: { value: MemoryType | "" } }) => setFilterType(event.target.value), "aria-label": t("memory.typeFilter") }, createElement("option", { value: "" }, t("memory.allTypes")), workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value)))),
              createElement("label", null, `${t("memory.statusFilter")} `, createElement("select", { value: statusFilter, onChange: (event: { target: { value: MemoryStatus } }) => setStatusFilter(event.target.value), "aria-label": t("memory.statusFilter") }, (["active", "archived", "forgotten"] as const).map((value) => createElement("option", { key: value, value }, value)))),
              createElement("button", { type: "button", onClick: () => void exportMemory() }, t("memory.export")),
              createElement("label", null, `${t("memory.import")} `, createElement("input", { type: "file", disabled: !writesAllowed, accept: "application/json,.json,.jsonl", onChange: (event: { target: { files?: readonly { size?: number; text: () => Promise<string> }[] } }) => void importMemory(event) })),
            ),
          ),
          createElement("header", { "data-dsh-workspace": "surface-header" },
            createElement("div", { "data-dsh-workspace": "surface-title" },
              createElement("h3", null, t("memory.title")),
              workspaceCountBadge(`${records.length} ${records.length === 1 ? t("memory.recordOne") : t("memory.records")}`),
            ),
          ),
          workspaceListDetail(
            records.length === 0
              ? workspaceEmptyState(t("memory.empty"))
              : recordList,
            createElement("div", { "data-dsh-workspace": "memory-detail-column" },
              selected && selectedGovernance && createElement("dl", { "aria-label": t("memory.governance"), "data-dsh-workspace": "memory-governance" },
                createElement("dt", null, t("memory.origin")), createElement("dd", null, selectedGovernance.origin),
                createElement("dt", null, t("memory.verification")), createElement("dd", null, selectedGovernance.verification),
                createElement("dt", null, t("memory.retention")), createElement("dd", null, selectedGovernance.retention),
                createElement("dt", null, t("memory.revision")), createElement("dd", null, String(selectedGovernance.revision)),
                createElement("dt", null, t("memory.sources")), createElement("dd", null, selectedGovernance.sourceRefs.map((source) => `${source.kind}/${source.id}`).join(", ") || t("memory.none")),
                selectedGovernance.conflictGroup && createElement("dt", null, t("memory.conflictGroup")),
                selectedGovernance.conflictGroup && createElement("dd", null, selectedGovernance.conflictGroup),
                selectedGovernance.expiresAt !== undefined && createElement("dt", null, t("memory.expires")),
                selectedGovernance.expiresAt !== undefined && createElement("dd", null, String(selectedGovernance.expiresAt)),
              ),
              hasConflict && createElement("p", { role: "status" }, t("memory.conflictHint")),
              hasConflict && createElement("aside", { "aria-label": t("memory.conflictTitle"), "data-dsh-workspace": "memory-conflict" },
                createElement("h3", null, t("memory.conflictTitle")),
                createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void resolveConflict() }, t("memory.keepVersion")),
                createElement("div", { "data-dsh-workspace": "memory-conflict-columns" },
                  [selected!, ...conflictingRecords].map((record) => {
                    const keep = record.id === selectedId;
                    const governance = displayGovernance(record);
                    return createElement("section", { key: record.id, "data-dsw-version": keep ? "keep" : "conflict", "aria-label": `Version ${record.contentHash.slice(0, 8)}` },
                      createElement("div", { "data-dsh-workspace": "surface-header" },
                        createElement("div", { "data-dsh-workspace": "surface-title" },
                          createElement("h4", null, keep ? t("memory.selected") : t("memory.conflict")),
                          createElement("span", { "data-dsh-workspace": "status-chip", "data-status": governance.verification === "verified" ? "verified" : "unverified" }, governance.verification),
                        ),
                      ),
                      createElement("button", { type: "button", onClick: () => setSelectedId(record.id) }, `${t("memory.review")} · rev ${governance.revision} · ${record.contentHash.slice(0, 15)}`),
                      createElement("pre", null, record.content.slice(0, 512)),
                    );
                  }),
                ),
              ),
              editor,
              createElement("p", { role: "status" }, state?.readOnly ? t("memory.readOnly") : t("memory.reviewOnly")),
              message && createElement("p", { role: "status" }, message),
            ),
          ),
        );
    const confirmation = forgetPending && selected && createElement("div", { role: "alertdialog", "aria-modal": "true", "aria-labelledby": "memory-forget-title", "aria-describedby": "memory-forget-description" },
      createElement("h3", { id: "memory-forget-title" }, t("memory.forgetTitle")),
      createElement("p", { id: "memory-forget-description" }, t("memory.forgetDescription", { scope: scopeLabel(selected.scope) })),
      createElement("button", { ref: confirmButton, type: "button", onClick: () => { setForgetPending(false); void mutate("forget"); } }, t("memory.forgetRecord")),
      createElement("button", { type: "button", onClick: () => { setForgetPending(false); forgetTrigger.current?.focus(); } }, t("cancel")),
    );
    if (!sessionId) {
      return createElement("section", { role: "region", "aria-label": t("memory.title"), "data-dsh-workspace": "memory" },
        createElement("h2", null, t("memory.title")),
        createElement("p", { role: "status" }, t("memory.requireSession")));
    }
    return createElement("section", { role: "region", "aria-label": t("memory.title"), "data-dsh-workspace": "memory" }, createElement("h2", null, t("memory.title")), body, confirmation);
  };
}
