import { realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type { ActivityProjection } from "../domain/activity.ts";
import { deriveArtifacts } from "../domain/activity.ts";
import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import { createWorkspaceDeliverable } from "../domain/deliverable.ts";
import { PreviewPanelError, PreviewService, type PreviewDescriptor } from "../domain/preview.ts";
import { SessionActivityObserver, type NativeDurableToolRecord } from "../domain/observation.ts";
import { normalizeWorkspacePath, type WorkspaceIdentity, type WorkspaceSnapshot } from "../domain/workspace.ts";

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
    const result = data.meta ?? { locations: [] };
    records.push({
      seq: event.seq,
      time: event.time,
      type: event.type,
      data: {
        tool: call?.name ?? "tool",
        callId,
        arguments: call?.arguments ?? {},
        result,
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

async function fileSize(root: string, path: string): Promise<number> {
  const normalized = normalizeWorkspacePath(path);
  const canonicalRoot = await realpath(root);
  const canonicalPath = await realpath(join(canonicalRoot, normalized));
  const relativePath = relative(canonicalRoot, canonicalPath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
  const info = await stat(canonicalPath);
  if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Artifact is not a file");
  return info.size;
}

function artifactDescriptorPath(descriptor: PreviewDescriptor, path: string): PreviewDescriptor {
  return "path" in descriptor ? descriptor : ({ ...descriptor, path } as PreviewDescriptor);
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
      const descriptor = await this.preview.preview(item.path);
      let sizeBytes = 0;
      try { sizeBytes = await fileSize(this.root, item.path); } catch { continue; }
      const artifact = createWorkspaceDeliverable(
        descriptor,
        { sessionId: this.identity.sessionId, workspaceId: this.identity.rootId, kind: "artifact" },
        sizeBytes,
        { name: item.path },
      );
      next.set(artifact.id, { path: item.path, artifact });
    }
    this.artifacts = next;
    return [...next.values()].map((entry) => entry.artifact);
  }

  async previewArtifact(id: string): Promise<WorkspaceArtifactPreview> {
    if (typeof id !== "string" || !id.trim()) return { type: "error", code: "RESOURCE_INVALID", message: "Artifact identity is invalid" };
    if (!this.artifacts.has(id)) await this.metadata();
    const entry = this.artifacts.get(id);
    if (!entry) return { type: "error", code: "RESOURCE_INVALID", message: "Artifact is unavailable" };
    const descriptor = await this.preview.preview(entry.path);
    return descriptorWithoutPath(artifactDescriptorPath(descriptor, entry.path));
  }

  dispose(): void {
    this.preview.dispose();
    this.artifacts.clear();
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
