import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import type { PreviewDescriptor } from "../domain/preview.ts";
import { normalizeWorkspacePath } from "../domain/path.ts";

export type { WorkspaceDeliverable, WorkspaceDeliverablePreview, WorkspaceDeliverableSource } from "../domain/deliverable.ts";

export type WorkspaceArtifactDetailStatus = "idle" | "loading" | "ready" | "unsupported" | "oversized" | "stale" | "error";

export interface WorkspaceArtifactView {
  readonly items: readonly WorkspaceDeliverable[];
  readonly selected?: WorkspaceDeliverable;
}

export interface WorkspaceArtifactDetail {
  readonly artifact: WorkspaceDeliverable;
  readonly descriptor?: PreviewDescriptor;
  readonly status: WorkspaceArtifactDetailStatus;
  readonly message?: string;
}

export type WorkspaceDownloadStatus = "ready" | "cancelled" | "unsupported" | "oversized" | "stale" | "error";

export interface WorkspaceDownloadResult {
  readonly status: WorkspaceDownloadStatus;
  readonly url?: string;
  readonly downloadName?: string;
  readonly message?: string;
}

export interface WorkspaceFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly blob: () => Promise<Blob>;
}

export interface WorkspaceDownloadRuntime {
  readonly fetch: (url: string, init: { readonly signal: AbortSignal }) => Promise<WorkspaceFetchResponse>;
  readonly createObjectURL: (blob: Blob) => string;
  readonly revokeObjectURL: (url: string) => void;
}

const previewStatuses: readonly WorkspaceDeliverable["preview"][] = ["available", "unsupported", "oversized", "stale"];
const safeOpaque = /^[A-Za-z0-9:_-]+$/u;
const safeMediaType = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/u;

function safeText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

function assertArtifact(value: WorkspaceDeliverable): WorkspaceDeliverable {
  if (!value || typeof value !== "object"
    || !safeText(value.id, 256) || !safeOpaque.test(value.id)
    || !safeText(value.name, 256) || /[\\/]/u.test(value.name) || value.name === "." || value.name === ".."
    || !safeText(value.mediaType, 256) || !safeMediaType.test(value.mediaType)
    || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes < 0
    || !previewStatuses.includes(value.preview)
    || !safeText(value.downloadName, 180) || /[\\/]/u.test(value.downloadName) || value.downloadName === "." || value.downloadName === ".."
    || !value.source || !safeText(value.source.sessionId, 256) || /[\\/]/u.test(value.source.sessionId)
    || !safeText(value.source.workspaceId, 256) || /[\\/]/u.test(value.source.workspaceId)
    || (value.source.kind !== "artifact" && value.source.kind !== "file")
    || (value.resourceId !== undefined && (!safeText(value.resourceId, 256) || !safeOpaque.test(value.resourceId)))
    || (value.version !== undefined && (!safeText(value.version, 512) || /[\\/]/u.test(value.version)))
    || (value.altText !== undefined && !safeText(value.altText, 256))) {
    throw new Error("Workspace artifact metadata is invalid");
  }
  if (value.mediaType.startsWith("image/") && value.preview === "available" && !safeText(value.altText, 256)) {
    throw new Error("Workspace image artifacts require accessibility text");
  }
  const source = Object.freeze({
    sessionId: value.source.sessionId,
    workspaceId: value.source.workspaceId,
    kind: value.source.kind,
  });
  return Object.freeze({
    id: value.id,
    name: value.name,
    mediaType: value.mediaType,
    sizeBytes: value.sizeBytes,
    ...(value.version === undefined ? {} : { version: value.version }),
    source,
    preview: value.preview,
    ...(value.resourceId === undefined ? {} : { resourceId: value.resourceId }),
    downloadName: value.downloadName,
    ...(value.altText === undefined ? {} : { altText: value.altText }),
  });
}

/** Validate and deterministically order metadata without exposing a Workspace Path. */
export function normalizeWorkspaceArtifacts(input: readonly WorkspaceDeliverable[]): readonly WorkspaceDeliverable[] {
  if (!Array.isArray(input)) throw new Error("Workspace artifacts must be an array");
  const seen = new Set<string>();
  return Object.freeze(input.map(assertArtifact).filter((artifact) => {
    if (seen.has(artifact.id)) throw new Error("Workspace artifact ids must be unique");
    seen.add(artifact.id);
    return true;
  }).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)));
}

export function createWorkspaceArtifactView(input: readonly WorkspaceDeliverable[], selectedId?: string): WorkspaceArtifactView {
  const items = normalizeWorkspaceArtifacts(input);
  if (selectedId !== undefined && (!safeText(selectedId, 256) || !safeOpaque.test(selectedId))) throw new Error("Workspace artifact selection is invalid");
  return Object.freeze({ items, ...(selectedId === undefined ? {} : { selected: items.find((artifact) => artifact.id === selectedId) }) });
}

function detailStatus(descriptor: PreviewDescriptor): WorkspaceArtifactDetailStatus {
  if (descriptor.type === "unsupported") return "unsupported";
  if (descriptor.type !== "error") return "ready";
  if (descriptor.code === "FILE_TOO_LARGE") return "oversized";
  if (descriptor.code === "RESOURCE_STALE") return "stale";
  return "error";
}

export function createWorkspaceArtifactDetail(artifact: WorkspaceDeliverable, descriptor?: PreviewDescriptor): WorkspaceArtifactDetail {
  const safeArtifact = assertArtifact(artifact);
  if (!descriptor) return { artifact: safeArtifact, status: safeArtifact.preview === "available" ? "idle" : safeArtifact.preview };
  if ("path" in descriptor) {
    try {
      if (normalizeWorkspacePath(descriptor.path) !== descriptor.path) return { artifact: safeArtifact, status: "error", message: "Preview path is invalid" };
    } catch {
      return { artifact: safeArtifact, status: "error", message: "Preview path is invalid" };
    }
  }
  if (descriptor.type === "binary" && (safeArtifact.resourceId !== descriptor.resourceId
    || safeArtifact.mediaType !== descriptor.mediaType
    || (safeArtifact.version !== undefined && safeArtifact.version !== descriptor.version))) {
    return { artifact: safeArtifact, status: "error", message: "Preview resource identity is invalid" };
  }
  return {
    artifact: safeArtifact,
    descriptor,
    status: detailStatus(descriptor),
    ...(descriptor.type === "error" ? { message: descriptor.message } : descriptor.type === "unsupported" ? { message: descriptor.reason } : {}),
  };
}

export function buildWorkspaceResourceUrl(artifact: WorkspaceDeliverable, resourcePath = "/workspace/resource"): string | undefined {
  const safeArtifact = assertArtifact(artifact);
  if (!safeArtifact.resourceId || typeof resourcePath !== "string" || !/^\/[A-Za-z0-9._/-]+$/u.test(resourcePath) || resourcePath.endsWith("/")) return undefined;
  const url = new URL(resourcePath, "http://workspace.local");
  url.searchParams.set("id", safeArtifact.resourceId);
  url.searchParams.set("type", safeArtifact.mediaType);
  url.searchParams.set("download", "1");
  return `${url.pathname}${url.search}`;
}

function responseStatus(status: number): WorkspaceDownloadStatus {
  if (status === 404 || status === 410) return "stale";
  if (status === 413) return "oversized";
  return "error";
}

/** Own one cancellable browser download and its object-URL cleanup. */
export function createWorkspaceDownloadController(runtime: WorkspaceDownloadRuntime, resourcePath = "/workspace/resource") {
  let active: AbortController | undefined;
  let activeObjectUrl: string | undefined;
  return {
    cancel(): void { active?.abort(); },
    release(url: string): void {
      if (typeof url !== "string" || !url) return;
      runtime.revokeObjectURL(url);
      if (activeObjectUrl === url) activeObjectUrl = undefined;
    },
    async start(artifact: WorkspaceDeliverable): Promise<WorkspaceDownloadResult> {
      const url = buildWorkspaceResourceUrl(artifact, resourcePath);
      if (!url) return { status: "unsupported", message: "This artifact has no authorized download resource" };
      active?.abort();
      if (activeObjectUrl) {
        runtime.revokeObjectURL(activeObjectUrl);
        activeObjectUrl = undefined;
      }
      const controller = new AbortController();
      active = controller;
      try {
        const response = await runtime.fetch(url, { signal: controller.signal });
        if (!response.ok) return { status: responseStatus(response.status), message: "Workspace download is unavailable" };
        const objectUrl = runtime.createObjectURL(await response.blob());
        if (controller.signal.aborted) {
          runtime.revokeObjectURL(objectUrl);
          return { status: "cancelled", message: "Workspace download cancelled" };
        }
        activeObjectUrl = objectUrl;
        return { status: "ready", url: objectUrl, downloadName: artifact.downloadName };
      } catch (error) {
        if (controller.signal.aborted || (error as { name?: string })?.name === "AbortError") return { status: "cancelled", message: "Workspace download cancelled" };
        return { status: "error", message: "Workspace download is unavailable" };
      } finally {
        if (active === controller) active = undefined;
      }
    },
  };
}
