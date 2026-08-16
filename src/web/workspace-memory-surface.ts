import { createElement, useEffect, useRef, useState, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type {
  MemoryDraft,
  MemoryListOptions,
  MemoryReadState,
  MemoryRecord,
  MemorySearchOptions,
  MemoryScopeRequest,
  MemoryType,
} from "../types.ts";

export const WORKSPACE_MEMORY_OVERLAY_SLOT = "shell.overlay" as const;
export const WORKSPACE_MEMORY_ENTRY_KEY = "dsh-workspace-memory" as const;

export interface WorkspaceMemoryRemote {
  readonly memoryOpen: (request: MemoryScopeRequest) => Promise<RemoteResult<MemoryReadState>>;
  readonly memoryList: (request: MemoryScopeRequest, options?: MemoryListOptions) => Promise<RemoteResult<readonly MemoryRecord[]>>;
  readonly memorySearch: (request: MemoryScopeRequest, query: string, options?: MemorySearchOptions) => Promise<RemoteResult<readonly MemoryRecord[]>>;
  readonly memoryUpsert: (request: MemoryScopeRequest, draft: MemoryDraft) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryArchive: (request: MemoryScopeRequest, id: string) => Promise<RemoteResult<MemoryRecord>>;
  readonly memoryForget: (request: MemoryScopeRequest, id: string) => Promise<RemoteResult<MemoryRecord>>;
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
  return `${record.scope} · ${record.type} · ${provenance} · ${record.contentHash.slice(0, 15)}`;
}

function valueOf<T>(result: RemoteResult<T>): T {
  if (result.ok) return result.value;
  throw new Error("Memory capability is unavailable");
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Memory operation failed; records were not changed.";
}

function scopeLabel(scope: MemoryScopeRequest["scope"]): string {
  return scope === "shared-project" ? "Shared Project" : scope[0]!.toUpperCase() + scope.slice(1);
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
    const [state, setState] = useState<MemoryReadState | undefined>();
    const [records, setRecords] = useState<readonly MemoryRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [query, setQuery] = useState("");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState<MemoryType>("fact");
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [message, setMessage] = useState<string | undefined>();
    const requestToken = useRef(0);
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const request = workspaceMemoryRequest(scope, userId, sharedProject);
    const selected = records.find((record) => record.id === selectedId);

    const load = async (text = query): Promise<void> => {
      const token = ++requestToken.current;
      if (!remote) {
        setStatus("degraded");
        setMessage("Workspace Memory is unavailable in this Web scope.");
        return;
      }
      try {
        const opened = valueOf(await remote.memoryOpen(request));
        const next = text.trim() ? valueOf(await remote.memorySearch(request, text, { limit: 100 })) : valueOf(await remote.memoryList(request, { limit: 100 }));
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
      setTitle("");
      setContent("");
      void load("");
      return () => { requestToken.current += 1; };
    }, [remote, request.scope, request.userId, request.sharedProject]);

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
        const draft: MemoryDraft = { scope: state.scope, scopeKey: state.scopeKey, type, title, content, tags: selected?.tags ?? [], provenance: { kind: "user" }, ...(selected ? { id: selected.id } : {}) };
        valueOf(await remote.memoryUpsert(request, draft));
        await load("");
        setMessage("Memory saved locally.");
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const mutate = async (operation: "archive" | "forget"): Promise<void> => {
      if (!remote || !selected) return;
      try {
        valueOf(await (operation === "archive" ? remote.memoryArchive(request, selected.id) : remote.memoryForget(request, selected.id)));
        setSelectedId(undefined);
        setTitle("");
        setContent("");
        await load("");
        setMessage(operation === "archive" ? "Memory archived locally." : "Memory forgotten locally.");
      } catch (error) { setMessage(errorMessage(error)); }
    };

    const scopeButtons = createElement("div", { role: "group", "aria-label": "Memory scope" }, (["project", "session", "user", "shared-project"] as const).map((value) => createElement("button", {
      key: value,
      type: "button",
      "aria-pressed": scope === value,
      onClick: () => { setScope(value); setSharedProject(value === "shared-project"); },
    }, scopeLabel(value))));
    const recordList = createElement("ul", { "aria-label": "Memory records" }, records.map((record) => createElement("li", { key: record.id },
      createElement("button", { ref: record.id === selectedId ? selectedButton : undefined, type: "button", "aria-pressed": record.id === selectedId, onClick: () => setSelectedId(record.id) }, record.title),
      createElement("span", null, ` ${workspaceMemoryRecordSummary(record)}`),
    )));
    const editor = createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); void save(); }, "aria-label": selected ? "Edit Memory" : "Create Memory" },
      createElement("label", null, "Title ", createElement("input", { value: title, maxLength: 256, onChange: (event: { target: { value: string } }) => setTitle(event.target.value) })),
      createElement("label", null, "Type ", createElement("select", { value: type, onChange: (event: { target: { value: MemoryType } }) => setType(event.target.value) }, workspaceMemoryTypes.map((value) => createElement("option", { key: value, value }, value)))),
      createElement("label", null, "Content ", createElement("textarea", { value: content, maxLength: 64 * 1024, onChange: (event: { target: { value: string } }) => setContent(event.target.value) })),
      createElement("button", { type: "submit", disabled: !state || state.readOnly }, selected ? "Save changes" : "Create Memory"),
      selected && createElement("button", { type: "button", onClick: () => void mutate("archive") }, "Archive"),
      selected && createElement("button", { type: "button", onClick: () => void mutate("forget") }, "Forget"),
    );
    const body = status === "loading"
      ? createElement("p", { role: "status" }, "Loading Workspace Memory…")
      : status === "degraded"
        ? createElement("p", { role: "status" }, message ?? "Workspace Memory is unavailable.")
        : createElement("div", { "data-dsh-workspace": "memory-surface" },
          scopeButtons,
          scope === "user" && createElement("label", null, "User profile ", createElement("input", { value: userId, onChange: (event: { target: { value: string } }) => setUserId(event.target.value), "aria-label": "User Memory profile" })),
          createElement("form", { onSubmit: (event: { preventDefault: () => void }) => { event.preventDefault(); void load(query); } }, createElement("label", null, "Search Memory ", createElement("input", { value: query, onChange: (event: { target: { value: string } }) => setQuery(event.target.value), "aria-label": "Search Memory" })), createElement("button", { type: "submit" }, "Search")),
          recordList,
          editor,
          createElement("p", { role: "status" }, state?.readOnly ? "Read-only Memory" : "Review only: Memory never injects records into Agent context."),
          message && createElement("p", { role: "status" }, message),
        );
    return createElement("section", { role: "region", "aria-label": "Workspace Memory", "data-dsh-workspace": "memory" }, createElement("h2", null, "Workspace Memory"), body);
  };
}
