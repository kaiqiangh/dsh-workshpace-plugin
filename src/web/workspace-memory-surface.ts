import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type {
  MemoryDraft,
  MemoryGovernance,
  MemoryListOptions,
  MemoryReadState,
  MemoryRecord,
  MemoryScopeRequest,
  MemorySearchOptions,
  MemoryStatus,
  MemoryType,
  MemoryVerification,
} from "../types.ts";
import { MEMORY_TYPES } from "../types.ts";
import type { MemoryGovernanceAction } from "../domain/memory-governance.ts";
import { remoteErrorMessage, unwrapRemote } from "./workspace-remote.ts";
import { workspaceCountBadge, workspaceEmptyState, workspaceListDetail, workspaceNotice, workspaceSurfaceHeader } from "./workspace-primitives.ts";
import { t, useWorkspaceLocale, type WorkspaceMessageKey } from "./workspace-i18n.ts";

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
  /** Human-readable Markdown export/import (v0.7). Absent on older hosts. */
  readonly memoryExportMarkdown?: (request: MemoryScopeRequest) => Promise<RemoteResult<string>>;
  readonly memoryImportMarkdown?: (request: MemoryScopeRequest, markdown: string) => Promise<RemoteResult<readonly MemoryRecord[]>>;
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

const scopeHints: Record<MemoryScopeRequest["scope"], WorkspaceMessageKey> = {
  project: "memory.scope.projectHint",
  session: "memory.scope.sessionHint",
  user: "memory.scope.userHint",
  "shared-project": "memory.scope.sharedHint",
};

const typeHints: Record<MemoryType, WorkspaceMessageKey> = {
  fact: "memory.type.factHint",
  decision: "memory.type.decisionHint",
  preference: "memory.type.preferenceHint",
  convention: "memory.type.conventionHint",
};

const statusLabels: Record<MemoryStatus, WorkspaceMessageKey> = {
  active: "memory.status.active",
  archived: "memory.status.archived",
  forgotten: "memory.status.forgotten",
};

function verificationLabel(verification: MemoryVerification): string {
  switch (verification) {
    case "verified": return t("memory.verified");
    case "rejected": return t("memory.rejected");
    case "stale": return t("memory.stale");
    default: return t("memory.unverified");
  }
}

/** Relative "2h ago" label; recomputed whenever the locale re-renders the surface. */
function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return t("memory.relative.justNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("memory.relative.minutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("memory.relative.hours", { count: hours });
  return t("memory.relative.days", { count: Math.round(hours / 24) });
}

function formatTimestamp(value: number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function sourcesText(governance: MemoryGovernance): string {
  if (governance.sourceRefs.length === 0) return t("memory.none");
  return governance.sourceRefs.map((source) => `${source.kind}/${source.id}`).join(", ");
}

/** Dotted-underline tip term backed by a native (accessible) title tooltip. */
function workspaceTip(label: ReactNode, tip: string | undefined, key?: string): ReactNode {
  return createElement("span", { key, "data-dsh-workspace": "memory-tip", title: tip ?? "" }, label);
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
    // Re-render on locale change so every label and relative time follows the app language.
    useWorkspaceLocale();
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
    const [viewSource, setViewSource] = useState(false);
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [message, setMessage] = useState<string | undefined>();
    const requestToken = useRef(0);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const scopeFirstButton = useRef<HTMLButtonElement | null>(null);
    const forgetTrigger = useRef<HTMLButtonElement | null>(null);
    const confirmButton = useRef<HTMLButtonElement | null>(null);
    const editorRef = useRef<HTMLDetailsElement | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const requestBase = workspaceMemoryRequest(scope, userId, sharedProject);
    const request: MemoryScopeRequest = scope === "shared-project" ? { ...requestBase, sharedWriteAcknowledged } : requestBase;
    const selected = records.find((record) => record.id === selectedId);
    const selectedGovernance = selected && displayGovernance(selected);
    const conflictingRecords = selected === undefined ? [] : records.filter((record) => record.id !== selected.id && record.type === selected.type && record.title.trim().toLocaleLowerCase() === selected.title.trim().toLocaleLowerCase() && record.contentHash !== selected.contentHash);
    const hasConflict = conflictingRecords.length > 0;
    const writesAllowed = scope !== "shared-project" || sharedWriteAcknowledged;
    const editingDisabled = !writesAllowed || state?.readOnly === true;

    useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

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

    const exportMemory = async (format: "json" | "markdown" = "json"): Promise<void> => {
      if (!remote) return;
      try {
        const isMarkdown = format === "markdown";
        if (isMarkdown && !remote.memoryExportMarkdown) throw new Error(t("memory.exportMarkdownUnsupported"));
        const serialized = valueOf(isMarkdown ? await remote.memoryExportMarkdown!(request) : await remote.memoryExport(request));
        const url = globalThis.URL?.createObjectURL?.(new Blob([serialized], { type: isMarkdown ? "text/markdown" : "application/json" }));
        if (url && typeof document !== "undefined") {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = isMarkdown ? "dsh-memory-export.md" : "dsh-memory-export.json";
          anchor.click();
          globalThis.URL.revokeObjectURL(url);
        }
        setMessage(t("memory.exportReady", { bytes: serialized.length }));
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const importMemory = async (event: { target: { files?: readonly { size?: number; name?: string; text: () => Promise<string> }[] } }): Promise<void> => {
      const file = event.target.files?.[0];
      if (!remote || !file) return;
      try {
        if (!writesAllowed) throw new Error(t("memory.sharedWriteAck"));
        if (file.size !== undefined && file.size > 8 * 1024 * 1024) throw new Error(t("memory.importSizeLimit"));
        const isMarkdown = file.name?.toLowerCase().endsWith(".md") === true;
        const imported = valueOf(isMarkdown && remote.memoryImportMarkdown
          ? await remote.memoryImportMarkdown(request, await file.text())
          : await remote.memoryImport(request, await file.text()));
        await load("");
        setMessage(t("memory.imported", { count: imported.length }));
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const copyContent = async (): Promise<void> => {
      if (!selected) return;
      try {
        if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") throw new Error(t("memory.copyUnavailable"));
        await navigator.clipboard.writeText(selected.content);
        setMessage(t("memory.copyCopied"));
      } catch (error) { setMessage(errorMessage(error, t("memory.copyFailed"))); }
    };

    const openEditor = (): void => {
      if (editorRef.current) editorRef.current.open = true;
      setTimeout(() => titleInputRef.current?.focus(), 0);
    };

    const onSearchChange = (event: { target: { value: string } }): void => {
      const next = event.target.value;
      setQuery(next);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => { void load(next); }, 200);
    };

    const scopeButtons = createElement("div", { "data-dsw-segment": "true", role: "group", "aria-label": t("memory.scope") }, (["project", "session", "user", "shared-project"] as const).map((value) => createElement("button", {
      key: value,
      ref: value === "project" ? scopeFirstButton : undefined,
      type: "button",
      "data-tip": t(scopeHints[value]),
      title: t(scopeHints[value]),
      "aria-pressed": scope === value,
      onClick: () => { setScope(value); setSharedProject(value === "shared-project"); setSharedWriteAcknowledged(false); },
    }, scopeLabel(value))));

    // Record list cards (prototype #123): title+time row, at most two chips
    // (type + verification), one-line content preview. The scope label rides
    // the relative-time meta line so the chip row never overflows.
    const recordList = createElement("ul", { "aria-label": t("memory.records"), "data-dsh-workspace": "memory-list" }, records.map((record) => {
      const governance = displayGovernance(record);
      return createElement("li", { key: record.id, "data-dsh-workspace": "memory-card", "data-selected": String(record.id === selectedId) },
        createElement("div", { "data-dsh-workspace": "memory-card-title-row" },
          createElement("button", {
            ref: record.id === selectedId ? selectedButton : undefined,
            type: "button",
            "data-dsh-workspace": "memory-select",
            title: record.title,
            "aria-pressed": record.id === selectedId,
            onClick: () => setSelectedId(record.id),
          }, record.title),
          createElement("span", { "data-dsh-workspace": "memory-card-time" }, `${relativeTime(record.updatedAt)} · ${scopeLabel(record.scope)}`),
        ),
        createElement("div", { "data-dsh-workspace": "memory-card-chips" },
          createElement("span", { "data-dsh-workspace": "memory-badge", "data-dsh-workspace-type": record.type, title: t(typeHints[record.type]) }, record.type),
          createElement("span", { "data-dsh-workspace": "memory-badge", "data-dsh-workspace-verification": governance.verification, title: t("memory.verifiedHint") }, verificationLabel(governance.verification)),
        ),
        createElement("span", { "data-dsh-workspace": "memory-preview" }, record.content.slice(0, 96)),
      );
    }));

    const editor = createElement("details", { key: "editor", ref: editorRef, "data-dsh-workspace": "memory-editor" },
      createElement("summary", null, selected ? `${t("memory.edit")} ${selected.title}` : t("memory.create")),
      createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); void save(); }, "aria-label": selected ? t("memory.edit") : t("memory.create") },
        createElement("label", null, `${t("memory.titleField")} `, createElement("input", { ref: titleInputRef, value: title, maxLength: 256, disabled: editingDisabled, onChange: (event: { target: { value: string } }) => setTitle(event.target.value) })),
        createElement("label", null, `${t("memory.typeField")} `, createElement("select", { value: type, disabled: editingDisabled, onChange: (event: { target: { value: MemoryType } }) => setType(event.target.value) }, workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value)))),
        createElement("label", null, `${t("memory.contentField")} `, createElement("textarea", { value: content, maxLength: 64 * 1024, disabled: editingDisabled, onChange: (event: { target: { value: string } }) => setContent(event.target.value) })),
        createElement("div", { "data-dsw-editor-actions": "true" },
          createElement("button", { type: "submit", "data-dsw-primary": "true", disabled: editingDisabled }, selected ? t("memory.saveChanges") : t("memory.save")),
          selected && selected.status === "active" && createElement("button", { type: "button", disabled: editingDisabled, onClick: () => void mutate("archive") }, t("memory.archive")),
          selected?.status === "archived" && createElement("button", { type: "button", disabled: editingDisabled, onClick: () => void mutate("restore") }, t("memory.restore")),
        ),
      ),
    );

    const governanceTable = selected && selectedGovernance && createElement("dl", { key: "governance", "aria-label": t("memory.governance"), "data-dsh-workspace": "memory-governance" },
      createElement("dt", null, workspaceTip(t("memory.origin"), t("memory.originHint"))), createElement("dd", null, selectedGovernance.origin),
      createElement("dt", null, workspaceTip(t("memory.verification"), t("memory.verifiedHint"))), createElement("dd", null, verificationLabel(selectedGovernance.verification)),
      createElement("dt", null, workspaceTip(t("memory.retention"), t("memory.retentionHint"))), createElement("dd", null, selectedGovernance.retention),
      createElement("dt", null, workspaceTip(t("memory.revision"), t("memory.revisionHint"))), createElement("dd", null, String(selectedGovernance.revision)),
      createElement("dt", null, workspaceTip(t("memory.sources"), t("memory.sourcesHint"))), createElement("dd", { "data-dsh-workspace": "memory-source", title: sourcesText(selectedGovernance) }, sourcesText(selectedGovernance)),
      selectedGovernance.conflictGroup && createElement("dt", null, t("memory.conflictGroup")),
      selectedGovernance.conflictGroup && createElement("dd", null, selectedGovernance.conflictGroup),
      selectedGovernance.expiresAt !== undefined && createElement("dt", null, workspaceTip(t("memory.expires"), t("memory.expiresHint"))),
      selectedGovernance.expiresAt !== undefined && createElement("dd", null, formatTimestamp(selectedGovernance.expiresAt)),
    );

    const sourcePanel = selected && selectedGovernance && viewSource && createElement("div", { key: "source", "data-dsh-workspace": "memory-source-panel" },
      createElement("h4", null, t("memory.sourceInfo")),
      createElement("dl", { "data-dsh-workspace": "memory-source-detail" },
        createElement("dt", null, t("memory.provenance.kind")), createElement("dd", null, selected.provenance.kind),
        selected.provenance.sessionId !== undefined && createElement("dt", null, t("memory.provenance.session")),
        selected.provenance.sessionId !== undefined && createElement("dd", null, selected.provenance.sessionId),
        selected.provenance.eventSeq !== undefined && createElement("dt", null, t("memory.provenance.eventSeq")),
        selected.provenance.eventSeq !== undefined && createElement("dd", null, String(selected.provenance.eventSeq)),
        selected.provenance.note !== undefined && createElement("dt", null, t("memory.provenance.note")),
        selected.provenance.note !== undefined && createElement("dd", null, selected.provenance.note),
        createElement("dt", null, t("memory.contentHash")), createElement("dd", { "data-dsh-workspace": "memory-source", title: selected.contentHash }, selected.contentHash),
      ),
      createElement("h4", null, t("memory.sources")),
      selectedGovernance.sourceRefs.length === 0
        ? createElement("p", { role: "status" }, t("memory.none"))
        : createElement("ul", { "data-dsh-workspace": "memory-source-refs" }, selectedGovernance.sourceRefs.map((source) =>
          createElement("li", { key: `${source.kind}/${source.id}` },
            createElement("span", { "data-dsh-workspace": "memory-source", title: source.id }, `${source.kind}/${source.id}`),
            source.contentHash && createElement("span", { "data-dsh-workspace": "memory-source", title: source.contentHash }, source.contentHash),
          ),
        )),
    );

    // Action row (prototype #123): Edit opens the inline editor; destructive
    // ops are last and tinted; every button carries a tooltip.
    const actions = selected && selectedGovernance && createElement("div", { key: "actions", "data-dsh-workspace": "memory-actions" },
      createElement("button", { type: "button", "data-dsw-primary": "true", title: t("memory.editHint"), disabled: editingDisabled, onClick: openEditor }, t("memory.edit")),
      selectedGovernance.verification === "unverified" && createElement("button", { type: "button", title: t("memory.verifyHint"), disabled: editingDisabled, onClick: () => void mutate("verify") }, t("memory.verify")),
      selectedGovernance.verification === "stale" && createElement("button", { type: "button", title: t("memory.reverifyHint"), disabled: editingDisabled, onClick: () => void mutate("reverify") }, t("memory.reverify")),
      selected.status === "active" && createElement("button", { type: "button", title: t("memory.archiveHint"), "data-dsw-tone": "danger", disabled: editingDisabled, onClick: () => void mutate("archive") }, t("memory.archive")),
      selected.status !== "forgotten" && createElement("button", { type: "button", title: t("memory.forgetHint"), "data-dsw-tone": "danger", disabled: editingDisabled, onClick: () => setForgetPending(true) }, t("memory.forget")),
      selectedGovernance.verification === "verified" && createElement("button", { type: "button", title: selectedGovernance.pinnedAt === undefined ? t("memory.pinHint") : t("memory.unpinHint"), disabled: editingDisabled, onClick: () => void mutate(selectedGovernance.pinnedAt === undefined ? "pin" : "unpin") }, selectedGovernance.pinnedAt === undefined ? t("memory.pin") : t("memory.unpin")),
      createElement("button", { type: "button", title: t("memory.copyHint"), onClick: () => void copyContent() }, t("memory.copy")),
      createElement("button", { type: "button", title: t("memory.viewSourceHint"), onClick: () => setViewSource((current) => !current) }, t("memory.viewSource")),
    );

    const conflictUi = selected && hasConflict && createElement("aside", { key: "conflict", "aria-label": t("memory.conflictTitle"), "data-dsh-workspace": "memory-conflict" },
      createElement("h3", null, t("memory.conflictTitle")),
      createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void resolveConflict() }, t("memory.keepVersion")),
      createElement("div", { "data-dsh-workspace": "memory-conflict-columns" },
        [selected!, ...conflictingRecords].map((record) => {
          const keep = record.id === selectedId;
          const governance = displayGovernance(record);
          return createElement("section", { key: record.id, "data-dsw-version": keep ? "keep" : "conflict", "aria-label": `${t("memory.version")} ${record.contentHash.slice(0, 8)}` },
            createElement("div", { "data-dsh-workspace": "surface-header" },
              createElement("div", { "data-dsh-workspace": "surface-title" },
                createElement("h4", null, keep ? t("memory.selected") : t("memory.conflict")),
                createElement("span", { "data-dsh-workspace": "status-chip", "data-status": governance.verification === "verified" ? "verified" : "unverified" }, governance.verification),
              ),
            ),
            createElement("button", { type: "button", onClick: () => setSelectedId(record.id) }, `${t("memory.review")} · ${t("memory.rev")} ${governance.revision} · ${record.contentHash.slice(0, 15)}`),
            createElement("pre", null, record.content.slice(0, 512)),
          );
        }),
      ),
    );

    const toolbar = createElement("div", { "data-dsh-workspace": "memory-toolbar" },
      createElement("div", { "data-dsw-row": "true" },
        scopeButtons,
        createElement("input", { "data-dsh-workspace": "memory-search", type: "search", value: query, placeholder: t("memory.searchPlaceholder"), "aria-label": t("memory.searchLabel"), onChange: onSearchChange }),
        createElement("select", { "data-dsh-workspace": "memory-filter-field", value: filterType, onChange: (event: { target: { value: MemoryType | "" } }) => setFilterType(event.target.value), "aria-label": t("memory.typeFilter") }, createElement("option", { value: "" }, t("memory.allTypes")), workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value))),
        createElement("select", { "data-dsh-workspace": "memory-filter-field", value: statusFilter, onChange: (event: { target: { value: MemoryStatus } }) => setStatusFilter(event.target.value), "aria-label": t("memory.statusFilter") }, (["active", "archived", "forgotten"] as const).map((value) => createElement("option", { key: value, value }, t(statusLabels[value])))),
        createElement("span", { "data-dsh-workspace": "memory-toolbar-spacer" }),
        createElement("button", { type: "button", title: t("memory.exportHint"), onClick: () => void exportMemory("json") }, t("memory.export")),
        remote?.memoryExportMarkdown ? createElement("button", { type: "button", title: t("memory.exportMarkdownHint"), onClick: () => void exportMemory("markdown") }, t("memory.exportMarkdown")) : null,
        createElement("label", { title: t("memory.importHint"), "data-dsh-workspace": "memory-import" }, `${t("memory.import")} `, createElement("input", { type: "file", disabled: !writesAllowed, accept: "application/json,.json,.jsonl,.md,.markdown", onChange: (event: { target: { files?: readonly { size?: number; name?: string; text: () => Promise<string> }[] } }) => void importMemory(event) })),
      ),
      (scope === "user" || scope === "shared-project") && createElement("div", { "data-dsw-row": "true" },
        scope === "user" && createElement("label", { "data-dsh-workspace": "memory-scope-field" }, `${t("memory.userProfile")} `, createElement("input", { value: userId, onChange: (event: { target: { value: string } }) => setUserId(event.target.value), "aria-label": t("memory.userProfile") })),
        scope === "shared-project" && createElement("label", { "data-dsh-workspace": "memory-scope-field" }, createElement("input", { type: "checkbox", checked: sharedWriteAcknowledged, onChange: (event: { target: { checked: boolean } }) => setSharedWriteAcknowledged(event.target.checked) }), t("memory.ackSharedWrite")),
      ),
    );

    const body = status === "loading"
      ? createElement("p", { role: "status" }, t("memory.loading"))
      : status === "degraded"
        ? workspaceNotice("error", message ?? t("memory.unavailable"))
        : createElement("div", { "data-dsh-workspace": "memory-surface" },
          toolbar,
          workspaceSurfaceHeader({ title: t("memory.title"), count: workspaceCountBadge(`${records.length} ${records.length === 1 ? t("memory.recordOne") : t("memory.records")}`) }),
          workspaceListDetail(
            records.length === 0
              ? workspaceEmptyState(t("memory.empty"))
              : recordList,
            createElement("div", { "data-dsh-workspace": "memory-detail" },
              selected && selectedGovernance
                ? [
                  createElement("div", { key: "header", "data-dsh-workspace": "memory-detail-header" },
                    createElement("h3", { title: selected.title }, selected.title),
                    createElement("div", { "data-dsh-workspace": "memory-detail-meta" },
                      createElement("span", { "data-dsh-workspace": "memory-badge", "data-dsh-workspace-type": selected.type, title: t(typeHints[selected.type]) }, selected.type),
                      createElement("span", { "data-dsh-workspace": "memory-badge", "data-dsh-workspace-verification": selectedGovernance.verification, title: t("memory.verifiedHint") }, verificationLabel(selectedGovernance.verification)),
                      createElement("span", { "data-dsh-workspace": "memory-detail-meta-text" }, ` · ${scopeLabel(selected.scope)} · ${t("memory.updatedAt", { when: relativeTime(selected.updatedAt) })}${selected.status !== "active" ? ` · ${t(statusLabels[selected.status]).toLocaleLowerCase()}` : ""}`),
                    ),
                  ),
                  createElement("pre", { key: "content", "data-dsh-workspace": "memory-content" }, selected.content),
                  governanceTable,
                  actions,
                  sourcePanel,
                  conflictUi,
                  editor,
                  state?.readOnly && workspaceNotice("warning", t("memory.saveDisabled"), "notice"),
                  createElement("p", { key: "status", role: "status" }, state?.readOnly ? t("memory.readOnly") : t("memory.reviewOnly")),
                  message && createElement("p", { key: "message", role: "status" }, message),
                ]
                : [
                  workspaceEmptyState(t("memory.selectHint"), "empty"),
                  editor,
                  createElement("p", { key: "status", role: "status" }, state?.readOnly ? t("memory.readOnly") : t("memory.reviewOnly")),
                  message && createElement("p", { key: "message", role: "status" }, message),
                ],
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
