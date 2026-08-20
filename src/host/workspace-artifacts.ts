import { realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type { ActivityProjection } from "../domain/activity.ts";
import { deriveArtifacts } from "../domain/activity.ts";
import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import { createWorkspaceDeliverable } from "../domain/deliverable.ts";
import { PreviewPanelError, PreviewService, type PreviewDescriptor } from "../domain/preview.ts";
import { SessionActivityObserver, type NativeDurableToolRecord } from "../domain/observation.ts";
import { normalizeWorkspacePath, type WorkspaceIdentity, type WorkspacePath, type WorkspaceSnapshot } from "../domain/workspace.ts";

export interface WorkspaceArtifactTextPreview {
  readonly type: "text";
  readonly renderer: "ui-primitives";
  readonly language?: string;
  readonly content: string;
  readonly truncated: boolean;
}

export interface WorkspaceArtifactMarkdownPreview {
  readonly type: "markdown";
  readonly renderer: "ui-primitives";
  readonly content: string;
  readonly truncated: boolean;
  readonly policy: {
    readonly allowRawHtml: false;
    readonly allowRemoteImages: false;
    readonly allowedLinkSchemes: readonly ["http", "https", "mailto"];
  };
  /**
   * Same-origin opaque resource URLs for the markdown's relative images,
   * keyed by the raw src (e.g. "./img.png" -> "/workspace/resource?id=..").
   * Images whose relative path escaped the root, or that failed to resolve,
   * are absent — the renderer then drops them (alt text only). A plain
   * object so it crosses the Typert remote boundary (no Map/symbol keys).
   */
  readonly imageUrls?: Readonly<Record<string, string>>;
}

export interface WorkspaceArtifactJsonPreview {
  readonly type: "json";
  readonly renderer: "ui-primitives";
  readonly value: WorkspaceJsonValue;
}

export type WorkspaceJsonValue = null | boolean | number | string | readonly WorkspaceJsonValue[] | {
  readonly [key: string]: WorkspaceJsonValue;
};

export interface WorkspaceArtifactCsvPreview {
  readonly type: "csv";
  readonly renderer: "ui-primitives";
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly truncated: boolean;
}

export interface WorkspaceArtifactBinaryPreview {
  readonly type: "binary";
  readonly mediaType: string;
  readonly resourceId: string;
  readonly version: string;
  readonly expiresAt: number;
}

export interface WorkspaceArtifactUnsupportedPreview {
  readonly type: "unsupported";
  readonly reason: string;
  readonly mediaType?: string;
  readonly size?: number;
}

export interface WorkspaceArtifactErrorPreview {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
}

export type WorkspaceArtifactPreview =
  | WorkspaceArtifactTextPreview
  | WorkspaceArtifactMarkdownPreview
  | WorkspaceArtifactJsonPreview
  | WorkspaceArtifactCsvPreview
  | WorkspaceArtifactBinaryPreview
  | WorkspaceArtifactUnsupportedPreview
  | WorkspaceArtifactErrorPreview;

export interface WorkspaceArtifactCarrierOptions {
  readonly workspace: WorkspaceSnapshot;
  readonly root: string;
  readonly records: () => readonly NativeDurableToolRecord[];
  readonly preview?: PreviewService;
}

interface ArtifactRecord {
  readonly path: string;
  readonly artifact: WorkspaceDeliverable;
  readonly descriptor: PreviewDescriptor;
}

export interface SessionEventLike {
  readonly seq: number;
  readonly time?: number;
  readonly type: string;
  readonly data?: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function shellWritePaths(tool: string | undefined, args: unknown): readonly string[] {
  if (tool === undefined || !/^(?:bash|sh|zsh|shell|terminal|exec)$/i.test(tool)) return [];
  const command = record(args)?.command;
  if (typeof command !== "string") return [];
  // ponytail: parse only explicit shell write targets; generated-script output
  // still needs filesystem reconciliation rather than unsafe command inference.
  const paths: string[] = [];
  const add = (value: string | undefined): void => {
    const path = value?.trim();
    if (!path || path.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(path) || path.split(/[\\/]/u).includes("..") || /[$`*?{}]/u.test(path)) return;
    if (!paths.includes(path)) paths.push(path);
  };
  const redirection = /(?:^|[\s;&|])\d*>>?\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gu;
  for (const match of command.matchAll(redirection)) add(match[1] ?? match[2] ?? match[3]);
  const directTarget = /(?:^|[;&|]\s*)(?:tee|touch)(?:\s+-[^\s]+)*\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gu;
  for (const match of command.matchAll(directTarget)) add(match[1] ?? match[2] ?? match[3]);
  return paths;
}

function operationFromResult(tool: string | undefined, args: unknown, content: readonly unknown[]): "create" | "update" | undefined {
  const shellPaths = shellWritePaths(tool, args);
  const firstPartyWrite = tool !== undefined && /^(?:write|write[-_]file|file[-_]write|create[-_]file)$/i.test(tool);
  if (!firstPartyWrite && shellPaths.length === 0) return undefined;
  const textParts: string[] = [];
  const collectText = (items: readonly unknown[]): void => {
    for (const item of items) {
      const block = record(item);
      if (!block) continue;
      if (typeof block.text === "string") textParts.push(block.text);
      if (Array.isArray(block.content)) collectText(block.content);
    }
  };
  collectText(content);
  const text = textParts.join("\n");
  if (/\bCreated file\b/i.test(text)) return "create";
  if (/\bUpdated file\b/i.test(text)) return "update";
  if (shellPaths.length > 0) return "create";
  return undefined;
}

function toSessionToolRecords(events: readonly SessionEventLike[]): readonly NativeDurableToolRecord[] {
  const calls = new Map<string, { readonly name: string; readonly arguments: unknown }>();
  const records: NativeDurableToolRecord[] = [];
  for (const event of events) {
    const data = event.data ?? {};
    if (event.type === "tool/call") {
      const callId = data.callId;
      const name = data.name;
      if (typeof callId === "string" && typeof name === "string") {
        let args: unknown = {};
        if (typeof data.arguments === "string") {
          try { args = JSON.parse(data.arguments) as unknown; } catch { args = {}; }
        }
        calls.set(callId, { name, arguments: args });
      }
      continue;
    }
    if (event.type !== "tool/result") continue;
    const message = record(data.message);
    const source = record(message?.source);
    const content = Array.isArray(message?.content) ? message.content : [];
    const block = record(content[0]);
    const callId = typeof source?.callId === "string" ? source.callId : typeof block?.toolCallId === "string" ? block.toolCallId : undefined;
    if (!callId) continue;
    const call = calls.get(callId);
    const meta = record(data.meta) ?? { locations: [] };
    const shellPaths = shellWritePaths(call?.name, call?.arguments);
    const operation = operationFromResult(call?.name, call?.arguments, content);
    records.push({
      seq: event.seq,
      time: event.time,
      type: event.type,
      data: {
        tool: call?.name ?? "tool",
        callId,
        arguments: call?.arguments ?? {},
        result: operation === undefined ? meta : {
          ...meta,
          operation,
          ...(shellPaths.length > 0 ? { paths: shellPaths } : {}),
        },
        ok: block?.isError !== true,
      },
    });
  }
  return records;
}

function descriptorWithoutPath(descriptor: PreviewDescriptor): WorkspaceArtifactPreview {
  switch (descriptor.type) {
    case "text": return {
      type: "text", renderer: descriptor.renderer, ...(descriptor.language === undefined ? {} : { language: descriptor.language }),
      content: descriptor.content, truncated: descriptor.truncated,
    };
    case "markdown": return {
      type: "markdown", renderer: descriptor.renderer, content: descriptor.content,
      truncated: descriptor.truncated, policy: descriptor.policy,
    };
    case "json": return { type: "json", renderer: descriptor.renderer, value: descriptor.value as WorkspaceJsonValue };
    case "csv": return {
      type: "csv", renderer: descriptor.renderer, columns: descriptor.columns, rows: descriptor.rows, truncated: descriptor.truncated,
    };
    case "binary": return {
      type: "binary", mediaType: descriptor.mediaType, resourceId: descriptor.resourceId,
      version: descriptor.version, expiresAt: descriptor.expiresAt,
    };
    case "unsupported": return {
      type: "unsupported", reason: descriptor.reason,
      ...(descriptor.mediaType === undefined ? {} : { mediaType: descriptor.mediaType }),
      ...(descriptor.size === undefined ? {} : { size: descriptor.size }),
    };
    case "error": return { type: "error", code: descriptor.code, message: descriptor.message };
  }
}

async function statArtifact(root: string, path: string): Promise<{ readonly size: number; readonly mtimeMs: number }> {
  const normalized = normalizeWorkspacePath(path);
  const canonicalRoot = await realpath(root);
  const canonicalPath = await realpath(join(canonicalRoot, normalized));
  const relativePath = relative(canonicalRoot, canonicalPath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
  const info = await stat(canonicalPath);
  if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Artifact is not a file");
  return { size: info.size, mtimeMs: info.mtimeMs };
}

function artifactDescriptorPath(descriptor: PreviewDescriptor, path: string): PreviewDescriptor {
  return "path" in descriptor ? descriptor : ({ ...descriptor, path } as PreviewDescriptor);
}

interface CachedArtifactDescriptor {
  readonly size: number;
  readonly mtimeMs: number;
  readonly descriptor: PreviewDescriptor;
}

/**
 * Session-scoped artifact carrier. It derives each snapshot from durable tool
 * records and keeps PreviewService as the only byte/resource authority.
 */
export class WorkspaceArtifactCarrier {
  readonly identity: WorkspaceIdentity;
  readonly preview: PreviewService;
  private readonly workspace: WorkspaceSnapshot;
  private readonly root: string;
  private readonly records: () => readonly NativeDurableToolRecord[];
  private artifacts = new Map<string, ArtifactRecord>();
  private readonly descriptorCache = new Map<string, CachedArtifactDescriptor>();

  constructor(options: WorkspaceArtifactCarrierOptions) {
    if (!options?.workspace || !options.root || typeof options.records !== "function") throw new Error("Workspace artifact carrier options are invalid");
    this.workspace = options.workspace;
    this.identity = options.workspace.identity;
    this.root = options.root;
    this.records = options.records;
    this.preview = options.preview ?? new PreviewService(options.root, this.identity);
  }

  async metadata(): Promise<readonly WorkspaceDeliverable[]> {
    const projection = this.projection();
    const next = new Map<string, ArtifactRecord>();
    for (const item of deriveArtifacts(projection)) {
      if (item.deleted) {
        const descriptor: PreviewDescriptor = { type: "error", code: "FILE_NOT_FOUND", message: "Artifact was deleted" };
        const artifact = createWorkspaceDeliverable(
          descriptor,
          { sessionId: this.identity.sessionId, workspaceId: this.identity.rootId, kind: "artifact" },
          0,
          { logicalPath: item.path, mediaType: "application/octet-stream", mtimeMs: item.createdAt },
        );
        next.set(artifact.id, { path: item.path, artifact, descriptor });
        continue;
      }
      let info: { readonly size: number; readonly mtimeMs: number } | undefined;
      try {
        info = await statArtifact(this.root, item.path);
        const cached = this.descriptorCache.get(item.path);
        let descriptor: PreviewDescriptor;
        if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) {
          descriptor = cached.descriptor;
        } else {
          descriptor = await this.preview.preview(item.path);
          this.descriptorCache.set(item.path, { size: info.size, mtimeMs: info.mtimeMs, descriptor });
        }
        const artifact = createWorkspaceDeliverable(
          descriptor,
          { sessionId: this.identity.sessionId, workspaceId: this.identity.rootId, kind: "artifact" },
          info.size,
          { name: item.path, mtimeMs: info.mtimeMs },
        );
        next.set(artifact.id, { path: item.path, artifact, descriptor });
      } catch (error) {
        const code = error instanceof PreviewPanelError ? error.code : "PROVIDER_UNAVAILABLE";
        const descriptor: PreviewDescriptor = {
          type: "error",
          code,
          message: error instanceof Error ? error.message : "Artifact is unavailable",
        };
        const artifact = createWorkspaceDeliverable(
          descriptor,
          { sessionId: this.identity.sessionId, workspaceId: this.identity.rootId, kind: "artifact" },
          info?.size ?? 0,
          { logicalPath: item.path, mediaType: "application/octet-stream", mtimeMs: info?.mtimeMs ?? item.createdAt },
        );
        next.set(artifact.id, { path: item.path, artifact, descriptor });
      }
    }
    this.artifacts = next;
    return [...next.values()].map((entry) => entry.artifact);
  }

  async previewArtifact(id: string): Promise<WorkspaceArtifactPreview> {
    if (typeof id !== "string" || !id.trim()) return { type: "error", code: "RESOURCE_INVALID", message: "Artifact identity is invalid" };
    if (!this.artifacts.has(id)) await this.metadata();
    const entry = this.artifacts.get(id);
    if (!entry) return { type: "error", code: "RESOURCE_INVALID", message: "Artifact is unavailable" };
    const descriptor = entry.descriptor.type === "binary" ? entry.descriptor : await this.preview.preview(entry.path);
    const preview = descriptorWithoutPath(artifactDescriptorPath(descriptor, entry.path));
    if (preview.type === "markdown") {
      // Resolve same-origin opaque URLs for every relative image in the
      // markdown (v0.6, dsh-web-ui port): the client renderer rewrites the
      // srcs so images beside the file display in the preview.
      const imageUrls: Record<string, string> = {};
      const srcPattern = /!\[[^\]]*\]\(([^)]+)\)/gu;
      for (const match of preview.content.matchAll(srcPattern)) {
        const src = match[1]?.trim();
        if (!src || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) continue;
        const url = await this.preview.markdownImageUrl(entry.path as WorkspacePath, src);
        if (url) imageUrls[src] = url;
      }
      return Object.keys(imageUrls).length > 0 ? { ...preview, imageUrls } : preview;
    }
    return preview;
  }

  dispose(): void {
    this.preview.dispose();
    this.artifacts.clear();
    this.descriptorCache.clear();
  }

  private projection(): ActivityProjection {
    const observer = new SessionActivityObserver(this.identity, this.workspace.baseline);
    observer.resume(this.records());
    return observer.projection;
  }
}

export function sessionToolRecords(events: readonly SessionEventLike[]): readonly NativeDurableToolRecord[] {
  return toSessionToolRecords(events);
}
