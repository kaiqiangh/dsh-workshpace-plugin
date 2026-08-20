import { createElement, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import type { PreviewDescriptor, PreviewErrorCode } from "../domain/preview.ts";
import type { WorkspacePath } from "../domain/path.ts";
import {
  buildWorkspaceResourceUrl,
  createWorkspaceArtifactDetail,
  createWorkspaceDownloadController,
  normalizeWorkspaceArtifacts,
  type WorkspaceDownloadRuntime,
} from "./workspace-deliverables.ts";
import { createWorkspacePreviewRenderer, type WorkspacePrimitiveSet } from "./workspace-preview-adapters.ts";
import { t, useWorkspaceLocale } from "./workspace-i18n.ts";
import { friendlyRemoteMessage, remoteCode, unwrapRemote } from "./workspace-remote.ts";
import { workspaceCountBadge, workspaceEmptyState, workspaceListDetail, workspaceNotice, workspaceSurfaceHeader } from "./workspace-primitives.ts";
import type { WorkspaceArtifactPreview, WorkspaceJsonValue } from "../host/workspace-artifacts.ts";

export const WORKSPACE_ARTIFACT_SLOT_NAME = "shell.overlay" as const;

/** Operational Budget: max open preview tabs (ADR #114). */
export const ARTIFACT_MAX_OPEN_TABS = 8;

export interface WorkspaceArtifactRemote {
  readonly artifactMetadata: () => Promise<RemoteResult<readonly WorkspaceDeliverable[]>>;
  readonly previewArtifact: (id: string) => Promise<RemoteResult<WorkspaceArtifactPreview>>;
}

export interface WorkspaceArtifactSurfaceOptions {
  readonly runtime?: WorkspaceDownloadRuntime;
  readonly resourcePath?: string;
  readonly refreshMs?: number;
  readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceArtifactRemote | undefined;
}

function descriptorFor(artifact: WorkspaceDeliverable, preview: WorkspaceArtifactPreview): PreviewDescriptor {
  const path = artifact.name as WorkspacePath;
  switch (preview.type) {
    case "text": return { type: "text", path, renderer: preview.renderer, ...(preview.language === undefined ? {} : { language: preview.language }), content: preview.content, truncated: preview.truncated };
    case "markdown": return { type: "markdown", path, renderer: preview.renderer, content: preview.content, truncated: preview.truncated, policy: preview.policy, ...(preview.imageUrls === undefined ? {} : { imageUrls: preview.imageUrls }) };
    case "json": return { type: "json", path, renderer: preview.renderer, value: preview.value as WorkspaceJsonValue };
    case "csv": return { type: "csv", path, renderer: preview.renderer, columns: preview.columns, rows: preview.rows, truncated: preview.truncated };
    case "binary": return { type: "binary", path, mediaType: preview.mediaType, resourceId: preview.resourceId, version: preview.version, expiresAt: preview.expiresAt };
    case "unsupported": return { type: "unsupported", path, reason: preview.reason, ...(preview.mediaType === undefined ? {} : { mediaType: preview.mediaType }), ...(preview.size === undefined ? {} : { size: preview.size }) };
    case "error": return { type: "error", code: preview.code as PreviewErrorCode, message: preview.message };
  }
}

function defaultRuntime(): WorkspaceDownloadRuntime | undefined {
  if (typeof globalThis.fetch !== "function" || typeof globalThis.URL?.createObjectURL !== "function") return undefined;
  return {
    fetch: (url, init) => globalThis.fetch(url, init),
    createObjectURL: (blob) => globalThis.URL.createObjectURL(blob),
    revokeObjectURL: (url) => globalThis.URL.revokeObjectURL(url),
  };
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  return `${Math.round(sizeBytes / (102.4 * 1024)) / 10} MB`;
}

/**
 * Humanize a filesystem mtime as a short relative time ("2h ago"). Renders
 * "—" when the mtime is unavailable so the row never shows `undefined`, and
 * clamps future/clock-skewed stamps to "just now".
 */
export function formatRelativeTime(mtimeMs: number | undefined, now: number = Date.now()): string {
  if (typeof mtimeMs !== "number" || !Number.isFinite(mtimeMs)) return "—";
  const delta = now - mtimeMs;
  if (!Number.isFinite(delta) || delta < 60_000) return t("artifacts.time.justNow");
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return t("artifacts.time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("artifacts.time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("artifacts.time.daysAgo", { count: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("artifacts.time.weeksAgo", { count: weeks });
  const date = new Date(mtimeMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Friendly, localized row label for a deliverable preview status. */
function artifactPreviewLabel(preview: WorkspaceDeliverable["preview"]): string {
  switch (preview) {
    case "unsupported": return t("artifacts.previewUnsupported");
    case "oversized": return t("artifacts.previewOversized");
    case "stale": return t("artifacts.previewStale");
    default: return t("artifacts.previewAvailable");
  }
}

export type WorkspaceArtifactCategory = "documents" | "data" | "images" | "other";

const documentTypes = new Set(["text/markdown", "text/plain", "application/pdf", "text/html", "application/x-yaml", "text/yaml", "application/x-toml"]);
const dataTypes = new Set(["application/json", "text/csv", "application/x-ndjson", "application/xml"]);
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Deterministic PRD-style grouping by media type (documents / data / images / other). */
export function workspaceArtifactCategory(mediaType: string): WorkspaceArtifactCategory {
  if (imageTypes.has(mediaType)) return "images";
  if (dataTypes.has(mediaType)) return "data";
  if (documentTypes.has(mediaType) || mediaType.startsWith("text/")) return "documents";
  return "other";
}

const categoryLabels: Record<WorkspaceArtifactCategory, () => string> = {
  documents: () => t("artifacts.category.documents"),
  data: () => t("artifacts.category.data"),
  images: () => t("artifacts.category.images"),
  other: () => t("artifacts.category.other"),
};

const categoryOrder: readonly WorkspaceArtifactCategory[] = ["documents", "data", "images", "other"];

function artifactGroups(artifacts: readonly WorkspaceDeliverable[]): readonly (readonly WorkspaceDeliverable[])[] {
  return categoryOrder.map((group) => artifacts.filter((artifact) => workspaceArtifactCategory(artifact.mediaType) === group));
}

function artifactTypeBadge(artifact: WorkspaceDeliverable): string {
  const name = artifact.name;
  const index = name.lastIndexOf(".");
  const extension = index === -1 ? "FILE" : name.slice(index + 1).toUpperCase().slice(0, 6);
  return extension;
}

function artifactIdentity(artifact: WorkspaceDeliverable | undefined): string {
  if (!artifact) return "";
  return [artifact.id, artifact.resourceId, artifact.version, artifact.sizeBytes, artifact.mtimeMs, artifact.preview, artifact.mediaType].join("\u0000");
}

/** Convert a path-free Host preview into the existing bounded renderer contract. */
export function workspaceArtifactPreviewDescriptor(artifact: WorkspaceDeliverable, preview: WorkspaceArtifactPreview): PreviewDescriptor {
  return descriptorFor(artifact, preview);
}

/** Lenient normalization: a single malformed artifact is skipped, not fatal. */
function normalizeLenient(input: readonly WorkspaceDeliverable[]): { readonly items: readonly WorkspaceDeliverable[]; readonly skipped: number } {
  try {
    return { items: normalizeWorkspaceArtifacts(input), skipped: 0 };
  } catch {
    const items: WorkspaceDeliverable[] = [];
    let skipped = 0;
    for (const item of input) {
      try {
        items.push(...normalizeWorkspaceArtifacts([item]));
      } catch {
        skipped += 1;
      }
    }
    return { items, skipped };
  }
}

/** Build one additive, keyboard-operable artifact list/detail surface. */
export function createWorkspaceArtifactSurfaceComponent(
  remote: WorkspaceArtifactRemote | undefined,
  primitives: WorkspacePrimitiveSet,
  options: WorkspaceArtifactSurfaceOptions = {},
): (props: Record<string, unknown>) => ReactNode {
  return function WorkspaceArtifactSurface(props: Record<string, unknown>): ReactNode {
    // Re-render every label when the host language flips (wayfinder #126).
    useWorkspaceLocale();
    const useSessions = props.useSessions as ((selector: (state: { readonly current?: string }) => string | undefined) => string | undefined) | undefined;
    const sessionId = useSessions?.((state) => state.current);
    const activeRemote = options.resolveRemote ? options.resolveRemote(sessionId) : remote;
    const [status, setStatus] = useState<"loading" | "ready" | "degraded">("loading");
    const [artifacts, setArtifacts] = useState<readonly WorkspaceDeliverable[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    // Read-only multi-tab preview (dsh-web-ui PreviewTabs pattern, minus
    // editing): ordered open artifact ids, the active tab, and per-tab
    // preview state so switching tabs never refetches (ADR #114).
    const [openTabs, setOpenTabs] = useState<readonly string[]>([]);
    const [tabStates, setTabStates] = useState<ReadonlyMap<string, { readonly descriptor?: PreviewDescriptor; readonly status: string; readonly message?: string }>>(new Map());
    const [detail, setDetail] = useState<PreviewDescriptor | undefined>();
    const [detailStatus, setDetailStatus] = useState("idle");
    const [query, setQuery] = useState("");
    const [skipped, setSkipped] = useState(0);
    const [message, setMessage] = useState<string | undefined>();
    const [download, setDownload] = useState<{ readonly url?: string; readonly name?: string; readonly status?: string; readonly message?: string }>({});
    const [refreshTick, setRefreshTick] = useState(0);
    const selectedButton = useRef<HTMLButtonElement | null>(null);
    const downloadController = useRef<ReturnType<typeof createWorkspaceDownloadController> | undefined>();
    const request = useRef(0);
    const detailArtifact = useRef<string | undefined>();
    const refreshRequest = useRef(0);
    const selectedIdRef = useRef<string | undefined>();
    const selectedIdentityRef = useRef("");
    const downloadRequest = useRef(0);
    const runtime = options.runtime ?? defaultRuntime();

    useEffect(() => {
      let active = true;
      if (!activeRemote) {
        setStatus("degraded");
        setMessage(t("artifacts.unavailable"));
        return () => { active = false; };
      }
      if (!sessionId) {
        // Without an active session the surface renders a static notice; do
        // not start the polling timer (avoids leaked intervals in tests).
        setStatus("degraded");
        return () => { active = false; };
      }
      const refresh = async (): Promise<void> => {
        const token = ++refreshRequest.current;
        try {
          const raw = unwrapRemote(await activeRemote.artifactMetadata());
          const normalized = normalizeLenient(raw);
          if (!active || token !== refreshRequest.current) return;
          const items = normalized.items;
          const currentId = selectedIdRef.current;
          const nextId = currentId && items.some((item) => item.id === currentId) ? currentId : items[0]?.id;
          const nextArtifact = items.find((item) => item.id === nextId);
          const nextIdentity = artifactIdentity(nextArtifact);
          const selectedArtifactChanged = selectedIdentityRef.current !== nextIdentity;
          const refreshTextPreview = nextArtifact !== undefined && nextArtifact.resourceId === undefined;
          selectedIdRef.current = nextId;
          selectedIdentityRef.current = nextIdentity;
          setArtifacts(items);
          setSkipped(normalized.skipped);
          setSelectedId(nextId);
          if (selectedArtifactChanged || refreshTextPreview) {
            request.current += 1;
            detailArtifact.current = undefined;
            setDetail(undefined);
            setDetailStatus("idle");
          }
          if (selectedArtifactChanged) {
            downloadRequest.current += 1;
            downloadController.current?.cancel();
            setDownload({});
          }
          setStatus("ready");
          setMessage(normalized.skipped > 0 ? `${normalized.skipped} ${t("artifacts.hiddenSkipped")}` : undefined);
        } catch {
          if (!active || token !== refreshRequest.current) return;
          setStatus((current) => current === "loading" ? "degraded" : current);
          setMessage(t("artifacts.unavailable"));
        }
      };
      void refresh();
      const refreshMs = options.refreshMs ?? 5_000;
      const timer = Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(() => { void refresh(); }, refreshMs) : undefined;
      return () => { active = false; refreshRequest.current += 1; if (timer !== undefined) clearInterval(timer); };
    }, [activeRemote, options.refreshMs, refreshTick]);

    useEffect(() => {
      if (selectedId) selectedButton.current?.focus();
    }, [selectedId]);

    useEffect(() => () => {
      downloadController.current?.cancel();
      if (download.url) downloadController.current?.release(download.url);
    }, [download.url]);
    useEffect(() => () => { downloadRequest.current += 1; }, []);

    const selected = artifacts.find((artifact) => artifact.id === selectedId);
    useEffect(() => {
      if (detailArtifact.current === selectedId) return;
      detailArtifact.current = selectedId;
      request.current += 1;
      setDetail(undefined);
      setDetailStatus("idle");
      setMessage(undefined);
    }, [selectedId]);
    useEffect(() => {
      detailArtifact.current = undefined;
      request.current += 1;
      selectedIdRef.current = undefined;
      selectedIdentityRef.current = "";
      setDetail(undefined);
      setDetailStatus("idle");
      setMessage(undefined);
      downloadRequest.current += 1;
      downloadController.current?.cancel();
      setDownload({});
    }, [activeRemote]);
    const select = (artifact: WorkspaceDeliverable): void => {
      downloadRequest.current += 1;
      downloadController.current?.cancel();
      detailArtifact.current = artifact.id;
      selectedIdRef.current = artifact.id;
      selectedIdentityRef.current = artifactIdentity(artifact);
      setSelectedId(artifact.id);
      setDownload({});
      // Open/activate the tab. A cached tab renders instantly; a new tab
      // fetches once and stores its descriptor for later switches.
      setOpenTabs((tabs) => tabs.includes(artifact.id) ? tabs : (tabs.length >= ARTIFACT_MAX_OPEN_TABS ? tabs : [...tabs, artifact.id]));
      const cached = tabStates.get(artifact.id);
      if (cached) {
        setDetail(cached.descriptor);
        setDetailStatus(cached.status);
        setMessage(cached.message);
        return;
      }
      setTabStates((states) => new Map(states).set(artifact.id, { status: "loading" }));
      setDetail(undefined);
      setDetailStatus("loading");
      setMessage(undefined);
      const token = ++request.current;
      activeRemote?.previewArtifact(artifact.id).then((result) => {
        if (token !== request.current) return;
        if (!result.ok) {
          const state = { status: "error", message: t("artifacts.previewUnavailable") };
          setTabStates((states) => new Map(states).set(artifact.id, state));
          setDetailStatus("error");
          setMessage(t("artifacts.previewUnavailable"));
          return;
        }
        const descriptor = descriptorFor(artifact, result.value);
        const detailValue = createWorkspaceArtifactDetail(artifact, descriptor);
        // Distinct, friendly copy for typed non-previewable states; a real
        // error keeps its readable host message (friendly error path).
        const statusMessage = detailValue.status === "unsupported"
          ? t("artifacts.previewUnsupported")
          : detailValue.status === "oversized"
            ? t("artifacts.previewOversized")
            : detailValue.status === "stale"
              ? t("artifacts.previewStale")
              : detailValue.message;
        const state = { descriptor: detailValue.descriptor, status: detailValue.status, message: statusMessage };
        setTabStates((states) => new Map(states).set(artifact.id, state));
        setDetail(detailValue.descriptor);
        setDetailStatus(detailValue.status);
        setMessage(statusMessage);
      }).catch((error) => {
        if (token !== request.current) return;
        const state = { status: "error", message: friendlyRemoteMessage(remoteCode(error), t("artifacts.previewUnavailable")) };
        setTabStates((states) => new Map(states).set(artifact.id, state));
        setDetailStatus("error");
        setMessage(t("artifacts.previewUnavailable"));
      });
    };

    const closeTab = (id: string): void => {
      setOpenTabs((tabs) => {
        const index = tabs.indexOf(id);
        if (index === -1) return tabs;
        const next = tabs.filter((tab) => tab !== id);
        setTabStates((states) => {
          const copy = new Map(states);
          copy.delete(id);
          return copy;
        });
        if (id === selectedIdRef.current) {
          const nextActive = next[Math.min(index, next.length - 1)];
          const nextArtifact = nextActive ? artifacts.find((item) => item.id === nextActive) : undefined;
          if (nextArtifact) {
            selectedIdRef.current = nextArtifact.id;
            selectedIdentityRef.current = artifactIdentity(nextArtifact);
            setSelectedId(nextArtifact.id);
            const cached = tabStates.get(nextArtifact.id);
            setDetail(cached?.descriptor);
            setDetailStatus(cached?.status ?? "idle");
            setMessage(cached?.message);
          } else {
            selectedIdRef.current = undefined;
            selectedIdentityRef.current = "";
            setSelectedId(undefined);
            setDetail(undefined);
            setDetailStatus("idle");
            setMessage(undefined);
          }
        }
        return next;
      });
    };

    useEffect(() => {
      if (status === "ready" && selected && detail === undefined && detailStatus === "idle") select(selected);
    }, [status, selectedId, artifacts, detail, detailStatus, activeRemote]);

    const downloadArtifact = async (): Promise<void> => {
      const token = ++downloadRequest.current;
      if (!selected || !runtime) {
        setDownload({ status: "unsupported", message: t("artifacts.downloadUnsupported") });
        return;
      }
      downloadController.current ??= createWorkspaceDownloadController(runtime, options.resourcePath);
      setDownload({ status: "loading" });
      const result = await downloadController.current.start(selected);
      if (token !== downloadRequest.current) {
        if (result.url) downloadController.current.release(result.url);
        return;
      }
      setDownload({ status: result.status, url: result.url, name: result.downloadName, message: result.message });
      if (result.status === "ready" && result.url && result.downloadName && typeof document !== "undefined") {
        const anchor = document.createElement("a");
        anchor.href = result.url;
        anchor.download = result.downloadName;
        anchor.click();
      }
    };

    const copyPath = async (): Promise<void> => {
      const artifact = selected;
      if (!artifact) return;
      const path = artifact.name;
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
      if (clipboard && typeof clipboard.writeText === "function") {
        try {
          await clipboard.writeText(path);
          setMessage(t("artifacts.copied"));
          return;
        } catch {
          setMessage(t("artifacts.copyUnsupported"));
          return;
        }
      }
      if (typeof document !== "undefined" && typeof document.execCommand === "function") {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = path;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const copied = document.execCommand("copy");
          document.body.removeChild(textarea);
          setMessage(copied ? t("artifacts.copied") : t("artifacts.copyUnsupported"));
          return;
        } catch {
          setMessage(t("artifacts.copyUnsupported"));
          return;
        }
      }
      setMessage(t("artifacts.copyUnsupported"));
    };

    const groupList = (group: readonly WorkspaceDeliverable[], groupIndex: number): ReactNode => {
      const category = categoryOrder[groupIndex] as WorkspaceArtifactCategory;
      return createElement(
        "section",
        { key: category, "data-dsh-workspace": "artifact-group", "aria-label": `${categoryLabels[category]()} ${t("artifacts.title").toLowerCase()}` },
        createElement("div", { "data-dsh-workspace": "artifact-group-header" },
          createElement("h4", null, categoryLabels[category]()),
          createElement("span", { "data-dsh-workspace": "count-badge", "data-dsw-variant": "neutral" }, String(group.length)),
        ),
        createElement("ul", { "data-dsh-workspace": "artifact-list" }, group.map((artifact) => createElement(
          "li",
          {
            key: artifact.id,
            "data-dsh-workspace": "artifact-item",
            "data-selected": String(artifact.id === selectedId),
          },
          createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "artifact-type-badge" }, artifactTypeBadge(artifact)),
          createElement(
            "button",
            {
              ref: artifact.id === selectedId ? selectedButton : undefined,
              type: "button",
              "data-dsh-workspace": "artifact-select",
              "aria-pressed": artifact.id === selectedId,
              onClick: () => select(artifact),
            },
            artifact.name,
          ),
          createElement("span", { "data-dsh-workspace": "artifact-meta", "aria-label": `${artifact.mediaType}, ${formatSize(artifact.sizeBytes)}, ${formatRelativeTime(artifact.mtimeMs)}, ${artifactPreviewLabel(artifact.preview)}` }, `${formatSize(artifact.sizeBytes)} · ${formatRelativeTime(artifact.mtimeMs)} · ${artifactPreviewLabel(artifact.preview)}`),
          createElement("code", { "data-dsh-workspace": "artifact-path", title: artifact.logicalPath ?? artifact.name }, artifact.logicalPath ?? artifact.name),
          createElement("span", { "aria-hidden": "true", "data-dsh-workspace": "artifact-status-chip", "data-status": artifact.preview }, artifactPreviewLabel(artifact.preview)),
        ))),
      );
    };

    const filtered = query.trim() ? artifacts.filter((artifact) => artifact.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : artifacts;
    const filteredGroups = artifactGroups(filtered);

    const artifactDetail: ReactNode = selected && detail
      ? createElement(
        "article",
        { "aria-label": `${selected.name} preview`, "data-dsh-workspace": "artifact-detail" },
        createElement("h3", null, selected.name),
        createElement("dl", { "data-dsh-workspace": "artifact-metadata", "aria-label": t("artifacts.provenance") },
          createElement("dt", null, t("artifacts.mediaType")),
          createElement("dd", null, selected.mediaType),
          createElement("dt", null, t("artifacts.location")),
          createElement("dd", null, selected.logicalPath ?? selected.name),
          createElement("dt", null, t("artifacts.size")),
          createElement("dd", null, formatSize(selected.sizeBytes)),
          createElement("dt", null, t("artifacts.modified")),
          createElement("dd", null, formatRelativeTime(selected.mtimeMs)),
          createElement("dt", null, t("artifacts.preview")),
          createElement("dd", null, artifactPreviewLabel(selected.preview)),
        ),
        createElement("p", { "aria-label": t("artifacts.provenance"), "data-dsh-workspace": "artifact-provenance" }, `${t("artifacts.source")} ${selected.source.kind} · session ${selected.source.sessionId} · workspace ${selected.source.workspaceId}`),
        createWorkspacePreviewRenderer(primitives, detail, { resourcePath: options.resourcePath, downloadName: selected.downloadName, altText: selected.altText }) as ReactNode,
        createElement("div", { role: "group" },
          createElement("button", { type: "button", "data-dsh-workspace": "artifact-copy-path", onClick: () => { void copyPath(); } }, t("artifacts.copyPath")),
          selected.resourceId && createElement("button", { type: "button", onClick: () => { void downloadArtifact(); } }, download.status === "loading" ? t("downloading") : t("download")),
          download.status === "loading" && createElement("button", { type: "button", onClick: () => downloadController.current?.cancel() }, t("cancelDownload")),
        ),
        download.message && createElement("p", { role: "status" }, download.message),
        download.status === "ready" && createElement("p", { role: "status" }, t("downloadStarted")),
        message && createElement("p", { role: "status" }, message),
      )
      : selected && !detail && detailStatus === "loading"
        ? createElement("p", { role: "status" }, t("artifacts.loadingPreview"))
        : selected && !detail && detailStatus !== "loading" && message
          ? createElement("p", { role: "status" }, message)
          : workspaceEmptyState(t("artifacts.selectHint"));

    // Read-only tab strip (dsh-web-ui PreviewTabs pattern): one tab per open
    // artifact, active tab highlighted, close button per tab. The detail pane
    // below renders the active tab's cached descriptor.
    const tablistRef = useRef<HTMLDivElement | null>(null);
    const onTablistKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.("[data-dsh-workspace='artifact-tab']")) return;
      const tabs = openTabs;
      if (tabs.length < 2) return;
      const current = tabs.indexOf(selectedId ?? "");
      const index = current === -1 ? 0 : current;
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      const artifact = artifacts.find((item) => item.id === tabs[next]);
      if (artifact) select(artifact);
    };
    const tabStrip = openTabs.length >= 1 ? createElement(
      "div",
      { ref: tablistRef, role: "tablist", "aria-label": t("artifacts.title"), "data-dsh-workspace": "artifact-tabs", onKeyDown: onTablistKeyDown },
      openTabs.map((id) => {
        const artifact = artifacts.find((item) => item.id === id);
        if (!artifact) return null;
        const active = id === selectedId;
        return createElement(
          "div",
          { key: id, role: "tab", "aria-selected": String(active), "data-dsh-workspace": "artifact-tab", "data-active": String(active), tabIndex: active ? 0 : -1 },
          createElement("button", { type: "button", "data-dsh-workspace": "artifact-tab-select", "aria-pressed": active, onClick: () => select(artifact) }, artifact.name),
          createElement("button", { type: "button", "data-dsh-workspace": "artifact-tab-close", "aria-label": `${t("cancel")} ${artifact.name}`, onClick: () => closeTab(id) }, "×"),
        );
      }),
    ) : null;

    const body = status === "loading"
      ? createElement("p", { role: "status" }, t("artifacts.loading"))
      : status === "degraded"
        ? workspaceNotice("error", message ?? t("artifacts.unavailable"))
        : createElement(
          "div",
          { "data-dsh-workspace": "artifact-surface" },
          workspaceSurfaceHeader({
            title: t("artifacts.title"),
            count: workspaceCountBadge(`${artifacts.length} ${artifacts.length === 1 ? t("artifacts.countOne") : t("artifacts.count")}`),
            actions: createElement("button", { type: "button", onClick: () => setRefreshTick((tick) => tick + 1) }, t("refresh")),
          }),
          createElement("div", { "data-dsh-workspace": "surface-toolbar" },
            // Filtering is a pure in-memory derived filter over already-fetched
            // metadata, so it is applied instantly on each keystroke (no remote
            // call to debounce — the spec's 200ms intent was to avoid per-key
            // RPC traffic, which does not apply here).
            createElement("form", { role: "search", onSubmit: (event: { preventDefault: () => void }) => event.preventDefault(), "aria-label": t("artifacts.searchLabel") },
              createElement("label", null, `${t("artifacts.searchLabel")} `, createElement("input", { type: "search", placeholder: t("artifacts.searchPlaceholder"), value: query, "aria-label": t("artifacts.searchLabel"), onChange: (event: { target: { value: string } }) => setQuery(event.target.value) })),
            ),
            skipped > 0 && createElement("span", { "data-dsh-workspace": "status-chip", "data-status": "stale" }, `${skipped} ${t("artifacts.hiddenSkipped")}`),
          ),
          artifacts.length === 0 && workspaceEmptyState(t("artifacts.empty")),
          artifacts.length === 0 && createElement("p", { role: "status", "data-dsh-workspace": "artifact-empty-explainer" }, t("artifacts.emptyExplainer")),
          artifacts.length > 0 && workspaceListDetail(
            filtered.length === 0
              ? workspaceEmptyState(t("artifacts.noMatch"))
              : filteredGroups.map((group, groupIndex) => group.length === 0 ? null : groupList(group, groupIndex)),
            createElement("div", { "data-dsh-workspace": "artifact-detail-column" },
              tabStrip,
              artifactDetail,
            ),
          ),
        );
    if (!sessionId) {
      return createElement("section", { "data-dsh-workspace": "artifacts", role: "region", "aria-label": t("artifacts.title") },
        createElement("h2", null, t("artifacts.title")),
        createElement("p", { role: "status" }, t("artifacts.requireSession")));
    }
    return createElement("section", { "data-dsh-workspace": "artifacts", role: "region", "aria-label": t("artifacts.title") }, createElement("h2", null, t("artifacts.title")), body);
  };
}

export function workspaceArtifactResourceUrl(artifact: WorkspaceDeliverable): string | undefined {
  return buildWorkspaceResourceUrl(artifact);
}
