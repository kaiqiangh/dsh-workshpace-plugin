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
import type { MemoryGovernanceAction } from "../domain/memory-governance.ts";

export const WORKSPACE_MEMORY_OVERLAY_SLOT = "shell.overlay" as const;
export const WORKSPACE_MEMORY_ENTRY_KEY = "dsh-workspace-memory" as const;

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
}

export interface WorkspaceMemorySurfaceOptions {
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceMemoryRemote | undefined;
  readonly remote?: WorkspaceMemoryRemote;
}

export const workspaceMemoryTypes: readonly MemoryType[] = ["decision", "preference", "convention", "fact"];

export function workspaceMemoryRequest(scope: MemoryScopeRequest["scope"], userId: string, sharedProject = false): MemoryScopeRequest {
  if (scope === "user") return { scope, userId: userId.trim() || "default" };
  return scope === "shared-project" ? { scope, sharedProject: true } : { scope };
}

export function workspaceMemoryRecordSummary(record: MemoryRecord): string {
  const provenance = record.provenance.sessionId ? `${record.provenance.kind}/${record.provenance.sessionId}` : record.provenance.kind;
  return `${record.scope} · ${record.type} · ${provenance} · ${record.contentHash.slice(0, 15)} · updated ${record.updatedAt} · last-used ${record.lastUsedAt ?? "never"} · used ${record.useCount}`;
}

function valueOf<T>(result: RemoteResult<T>): T {
  if (result.ok) return result.value;
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Memory operation failed; records were not changed.";
}

function scopeLabel(scope: MemoryScopeRequest["scope"]): string {
  return scope === "shared-project" ? "Shared Project" : scope[0]!.toUpperCase() + scope.slice(1);
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
    const [pinnedId, setPinnedId] = useState<string | undefined>();
    const [forgetPending, setForgetPending] = useState(false);
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [message, setMessage] = useState<string | undefined>();
    const requestToken = useRef(0);
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const scopeFirstButton = useRef<HTMLButtonElement | null>(null);
    const forgetTrigger = useRef<HTMLButtonElement | null>(null);
    const confirmButton = useRef<HTMLButtonElement | null>(null);
    const request = workspaceMemoryRequest(scope, userId, sharedProject);
    const selected = records.find((record) => record.id === selectedId);
    const selectedGovernance = selected && displayGovernance(selected);
    const hasConflict = selected !== undefined && records.some((record) => record.id !== selected.id && record.type === selected.type && record.title.trim().toLocaleLowerCase() === selected.title.trim().toLocaleLowerCase() && record.contentHash !== selected.contentHash);
    const writesAllowed = scope !== "shared-project" || sharedWriteAcknowledged;

    const load = async (text = query): Promise<void> => {
      const token = ++requestToken.current;
      if (!remote) {
        setStatus("degraded");
        setMessage("Workspace Memory is unavailable in this Web scope.");
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
        setMessage(opened.readOnly ? "This Memory file uses a newer schema and is read-only." : opened.warnings.length ? `${opened.warnings.length} local record warning(s).` : undefined);
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
      setPinnedId(undefined);
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

    const save = async (): Promise<void> => {
      if (!remote || !state) return;
      try {
      if (!writesAllowed) { setMessage("Acknowledge Shared Project writes before changing Memory."); return; }
      const draft: MemoryDraft = { scope: state.scope, scopeKey: state.scopeKey, type, title, content, tags: selected?.tags ?? [], provenance: { kind: "user" }, ...(selected ? { id: selected.id, expectedRevision: selectedGovernance?.revision ?? 1, expectedHash: selected.contentHash } : {}) };
        valueOf(await remote.memoryUpsert(request, draft));
        await load("");
        setMessage("Memory saved locally.");
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const mutate = async (operation: "archive" | "forget" | "verify" | "reverify" | "pin" | "unpin" | "restore" | "reject"): Promise<void> => {
      if (!remote || !selected) return;
      if (!writesAllowed) { setMessage("Acknowledge Shared Project writes before changing Memory."); return; }
      try {
        valueOf(await remote.memoryGovern(request, selected.id, operation, selectedGovernance?.revision ?? 1, selected.contentHash));
        setSelectedId(undefined);
        setTitle("");
        setContent("");
        await load("");
        if (operation === "forget") setTimeout(() => scopeFirstButton.current?.focus(), 0);
        const labels: Record<typeof operation, string> = { archive: "archived", forget: "forgotten", verify: "verified", reverify: "re-verified", pin: "pinned", unpin: "unpinned", restore: "restored", reject: "rejected" };
        setMessage(`Memory ${labels[operation]} locally.`);
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
        setMessage(`Memory export ready (${serialized.length} bytes).`);
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const importMemory = async (event: { target: { files?: readonly { size?: number; text: () => Promise<string> }[] } }): Promise<void> => {
      const file = event.target.files?.[0];
      if (!remote || !file) return;
      try {
        if (!writesAllowed) throw new Error("Acknowledge Shared Project writes before importing Memory.");
        if (file.size !== undefined && file.size > 8 * 1024 * 1024) throw new Error("Memory import exceeds the safe size limit.");
        const imported = valueOf(await remote.memoryImport(request, await file.text()));
        await load("");
        setMessage(`${imported.length} record(s) imported as unverified review items.`);
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const scopeButtons = createElement("div", { role: "group", "aria-label": "Memory scope" }, (["project", "session", "user", "shared-project"] as const).map((value) => createElement("button", {
      key: value,
      ref: value === "project" ? scopeFirstButton : undefined,
      type: "button",
      "aria-pressed": scope === value,
      onClick: () => { setScope(value); setSharedProject(value === "shared-project"); setSharedWriteAcknowledged(false); },
    }, scopeLabel(value))));
    const recordList = createElement("ul", { "aria-label": "Memory records" }, records.map((record) => createElement("li", { key: record.id },
      createElement("button", { ref: record.id === selectedId ? selectedButton : undefined, type: "button", "aria-pressed": record.id === selectedId, onClick: () => setSelectedId(record.id) }, record.title),
      createElement("span", null, ` ${workspaceMemoryRecordSummary(record)} · ${displayGovernance(record).verification}${record.status !== "active" ? ` · ${record.status}` : ""}`),
    )));
    const editor = createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); void save(); }, "aria-label": selected ? "Edit Memory" : "Create Memory" },
      createElement("label", null, "Title ", createElement("input", { value: title, maxLength: 256, onChange: (event: { target: { value: string } }) => setTitle(event.target.value) })),
      createElement("label", null, "Type ", createElement("select", { value: type, onChange: (event: { target: { value: MemoryType } }) => setType(event.target.value) }, workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value)))),
      createElement("label", null, "Content ", createElement("textarea", { value: content, maxLength: 64 * 1024, onChange: (event: { target: { value: string } }) => setContent(event.target.value) })),
      createElement("button", { type: "submit", disabled: !state || state.readOnly || !writesAllowed }, selected ? "Save changes" : "Create Memory"),
      selected && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("archive") }, "Archive"),
      selected && createElement("button", { ref: forgetTrigger, type: "button", disabled: !writesAllowed, onClick: () => setForgetPending(true) }, "Forget"),
      selected?.status === "archived" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("restore") }, "Restore"),
      selectedGovernance?.verification === "unverified" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("verify") }, "Verify"),
      selectedGovernance?.verification === "unverified" && hasConflict && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("reject") }, "Reject conflict"),
      selectedGovernance?.verification === "stale" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate("reverify") }, "Re-verify"),
      selectedGovernance?.verification === "verified" && createElement("button", { type: "button", disabled: !writesAllowed, onClick: () => void mutate(selectedGovernance.pinnedAt === undefined ? "pin" : "unpin") }, selectedGovernance.pinnedAt === undefined ? "Pin" : "Unpin"),
      selected && createElement("button", { type: "button", "aria-pressed": pinnedId === selected.id, onClick: () => { setPinnedId(selected.id); setMessage("Pinned for review only; Memory is not injected into Agent context."); } }, pinnedId === selected.id ? "Pinned for review" : "Pin for review"),
    );
    const body = status === "loading"
      ? createElement("p", { role: "status" }, "Loading Workspace Memory…")
      : status === "degraded"
        ? createElement("p", { role: "status" }, message ?? "Workspace Memory is unavailable.")
        : createElement("div", { "data-dsh-workspace": "memory-surface" },
          scopeButtons,
          scope === "shared-project" && createElement("label", null, createElement("input", { type: "checkbox", checked: sharedWriteAcknowledged, onChange: (event: { target: { checked: boolean } }) => setSharedWriteAcknowledged(event.target.checked) }), " I understand this writes to the shared Workspace Memory."),
          scope === "user" && createElement("label", null, "User profile ", createElement("input", { value: userId, onChange: (event: { target: { value: string } }) => setUserId(event.target.value), "aria-label": "User Memory profile" })),
          createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); void load(query); } }, createElement("label", null, "Search Memory ", createElement("input", { value: query, onChange: (event: { target: { value: string } }) => setQuery(event.target.value), "aria-label": "Search Memory" })), createElement("button", { type: "submit" }, "Search")),
          createElement("label", null, "Type filter ", createElement("select", { value: filterType, onChange: (event: { target: { value: MemoryType | "" } }) => setFilterType(event.target.value), "aria-label": "Filter Memory type" }, createElement("option", { value: "" }, "All types"), workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value)))),
          createElement("label", null, "Status filter ", createElement("select", { value: statusFilter, onChange: (event: { target: { value: MemoryStatus } }) => setStatusFilter(event.target.value), "aria-label": "Filter Memory status" }, (["active", "archived", "forgotten"] as const).map((value) => createElement("option", { key: value, value }, value)))),
          createElement("button", { type: "button", onClick: () => void exportMemory() }, "Export Memory"),
          createElement("label", null, "Import Memory ", createElement("input", { type: "file", disabled: !writesAllowed, accept: "application/json,.json,.jsonl", onChange: (event: { target: { files?: readonly { size?: number; text: () => Promise<string> }[] } }) => void importMemory(event) })),
          recordList,
          selected && selectedGovernance && createElement("dl", { "aria-label": "Memory governance" },
            createElement("dt", null, "Origin"), createElement("dd", null, selectedGovernance.origin),
            createElement("dt", null, "Verification"), createElement("dd", null, selectedGovernance.verification),
            createElement("dt", null, "Retention"), createElement("dd", null, selectedGovernance.retention),
            createElement("dt", null, "Revision"), createElement("dd", null, String(selectedGovernance.revision)),
            createElement("dt", null, "Sources"), createElement("dd", null, selectedGovernance.sourceRefs.map((source) => `${source.kind}/${source.id}`).join(", ") || "none"),
            selectedGovernance.conflictGroup && createElement("dt", null, "Conflict group"),
            selectedGovernance.conflictGroup && createElement("dd", null, selectedGovernance.conflictGroup),
            selectedGovernance.expiresAt !== undefined && createElement("dt", null, "Expires"),
            selectedGovernance.expiresAt !== undefined && createElement("dd", null, String(selectedGovernance.expiresAt)),
          ),
          hasConflict && createElement("p", { role: "status" }, "Conflicting Memory uses the same title and type with different content. Verify one or reject this item."),
          editor,
          createElement("p", { role: "status" }, state?.readOnly ? "Read-only Memory" : "Review only: Memory never injects records into Agent context."),
          message && createElement("p", { role: "status" }, message),
        );
    const confirmation = forgetPending && selected && createElement("div", { role: "alertdialog", "aria-modal": "true", "aria-labelledby": "memory-forget-title", "aria-describedby": "memory-forget-description" },
      createElement("h3", { id: "memory-forget-title" }, "Forget Memory?"),
      createElement("p", { id: "memory-forget-description" }, `This will tombstone 1 record in ${scopeLabel(selected.scope)}. Existing exports or model turns cannot be recalled.`),
      createElement("button", { ref: confirmButton, type: "button", onClick: () => { setForgetPending(false); void mutate("forget"); } }, "Forget record"),
      createElement("button", { type: "button", onClick: () => { setForgetPending(false); forgetTrigger.current?.focus(); } }, "Cancel"),
    );
    return createElement("section", { role: "region", "aria-label": "Workspace Memory", "data-dsh-workspace": "memory" }, createElement("h2", null, "Workspace Memory"), body, confirmation);
  };
}
