import { createHash } from "node:crypto";
import { basename } from "node:path";

import type { PreviewDescriptor } from "./preview.ts";
import { normalizeWorkspacePath, type WorkspacePath } from "./workspace.ts";

export type WorkspaceDeliverablePreview = "available" | "unsupported" | "oversized" | "stale";

export interface WorkspaceDeliverableSource {
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly kind: "artifact" | "file";
}

export interface WorkspaceDeliverable {
  readonly id: string;
  readonly name: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly version?: string;
  readonly source: WorkspaceDeliverableSource;
  readonly preview: WorkspaceDeliverablePreview;
  readonly resourceId?: string;
  readonly downloadName: string;
  readonly altText?: string;
  /** Filesystem last-modified time in epoch ms (surfaces show a relative time). */
  readonly mtimeMs?: number;
}

export interface WorkspaceDeliverableOptions {
  readonly name?: string;
  readonly mediaType?: string;
  readonly version?: string;
  readonly mtimeMs?: number;
}

export class WorkspaceDeliverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceDeliverableError";
  }
}

function assertText(value: unknown, label: string, max: number): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new WorkspaceDeliverableError(`${label} is invalid`);
  }
}

function opaqueId(source: WorkspaceDeliverableSource, path: string): string {
  return `workspace:${createHash("sha256").update(`${source.sessionId}:${source.workspaceId}:${path}`).digest("hex").slice(0, 32)}`;
}

function mediaExtension(mediaType: string): string {
  return mediaType === "application/pdf" ? ".pdf" : mediaType === "application/octet-stream" ? ".bin" : "";
}

/** Return a single safe basename suitable for Content-Disposition. */
export function safeDownloadName(pathInput: string, mediaType = "application/octet-stream"): string {
  let path: WorkspacePath;
  try {
    path = normalizeWorkspacePath(pathInput);
  } catch {
    throw new WorkspaceDeliverableError("Download name source path is invalid");
  }
  const raw = basename(path).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, "_").trim().replace(/^[. ]+|[. ]+$/gu, "");
  const name = raw || `workspace-download${mediaExtension(mediaType)}`;
  if (name === "." || name === "..") throw new WorkspaceDeliverableError("Download name is invalid");
  return name.slice(0, 180);
}

function previewState(descriptor: PreviewDescriptor): WorkspaceDeliverablePreview {
  if (descriptor.type === "error") {
    return descriptor.code === "FILE_TOO_LARGE" ? "oversized" : descriptor.code === "RESOURCE_STALE" ? "stale" : "unsupported";
  }
  if (descriptor.type === "unsupported") return descriptor.reason.includes("large") ? "oversized" : "unsupported";
  return "available";
}

function previewMediaType(descriptor: PreviewDescriptor, fallback?: string): string {
  if (descriptor.type === "binary" || descriptor.type === "unsupported") return descriptor.mediaType ?? "application/octet-stream";
  if (descriptor.type === "error") return fallback ?? "text/plain";
  if (descriptor.type === "markdown") return "text/markdown";
  if (descriptor.type === "json") return "application/json";
  if (descriptor.type === "csv") return "text/csv";
  return "text/plain";
}

/** Build bounded metadata without copying preview bytes into the envelope. */
export function createWorkspaceDeliverable(
  descriptor: PreviewDescriptor,
  source: WorkspaceDeliverableSource,
  sizeBytes: number,
  options: WorkspaceDeliverableOptions = {},
): WorkspaceDeliverable {
  if (!descriptor || typeof descriptor !== "object" || !source || typeof source !== "object" || !options || typeof options !== "object") throw new WorkspaceDeliverableError("Deliverable metadata is invalid");
  assertText(source.sessionId, "Source session", 256);
  assertText(source.workspaceId, "Source workspace", 256);
  if (source.kind !== "artifact" && source.kind !== "file") throw new WorkspaceDeliverableError("Source kind is invalid");
  if (options.name !== undefined) assertText(options.name, "Deliverable name", 256);
  if (options.mediaType !== undefined) assertText(options.mediaType, "Deliverable media type", 256);
  if (options.version !== undefined) assertText(options.version, "Deliverable version", 512);
  if (options.mtimeMs !== undefined && (typeof options.mtimeMs !== "number" || !Number.isFinite(options.mtimeMs) || options.mtimeMs < 0)) throw new WorkspaceDeliverableError("Deliverable mtime is invalid");
  let path: WorkspacePath | undefined;
  if ("path" in descriptor) {
    assertText(descriptor.path, "Descriptor path", 4_096);
    try {
      path = normalizeWorkspacePath(descriptor.path);
    } catch {
      throw new WorkspaceDeliverableError("Descriptor path is invalid");
    }
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new WorkspaceDeliverableError("Deliverable size is invalid");
  const mediaType = previewMediaType(descriptor, options.mediaType);
  const resourceId = descriptor.type === "binary" ? descriptor.resourceId : undefined;
  const version = descriptor.type === "binary" ? descriptor.version : options.version;
  let name = path ? basename(path) || "workspace-file" : "workspace-file";
  if (!path && options.name) {
    try {
      name = basename(normalizeWorkspacePath(options.name)) || "workspace-file";
    } catch {
      throw new WorkspaceDeliverableError("Deliverable name is invalid");
    }
  }
  const id = resourceId ? `workspace:${resourceId}` : opaqueId(source, path ?? name);
  return Object.freeze({
    id,
    name,
    mediaType,
    sizeBytes,
    ...(version === undefined ? {} : { version }),
    source: Object.freeze({ ...source }),
    preview: previewState(descriptor),
    ...(resourceId === undefined ? {} : { resourceId }),
    downloadName: safeDownloadName(path ?? name, mediaType),
    ...(mediaType.startsWith("image/") ? { altText: name } : {}),
    ...(options.mtimeMs === undefined ? {} : { mtimeMs: options.mtimeMs }),
  });
}

export function deliverableResourceId(descriptor: PreviewDescriptor): string | undefined {
  return descriptor.type === "binary" ? descriptor.resourceId : undefined;
}
