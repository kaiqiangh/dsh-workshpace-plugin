import { randomBytes } from "node:crypto";
import { open, realpath, stat, type FileHandle } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, sep } from "node:path";

import { normalizeWorkspacePath, type WorkspaceIdentity, type WorkspacePath } from "./workspace.ts";

const mib = 1024 * 1024;
const defaultResourceTtlMs = 60_000;
const defaultLimits: PreviewLimits = {
  maxTextBytes: 2 * mib,
  maxJsonBytes: 5 * mib,
  maxCsvBytes: 10 * mib,
  maxCsvRows: 1_000,
  maxImageBytes: 20 * mib,
  maxPdfBytes: 50 * mib,
};
const hardLimits: PreviewLimits = {
  maxTextBytes: 8 * mib,
  maxJsonBytes: 16 * mib,
  maxCsvBytes: 32 * mib,
  maxCsvRows: 10_000,
  maxImageBytes: 64 * mib,
  maxPdfBytes: 128 * mib,
};
const binaryExtensions = new Set([".7z", ".avi", ".bin", ".doc", ".docx", ".gz", ".mp3", ".mp4", ".odt", ".ppt", ".pptx", ".tar", ".wav", ".xls", ".xlsx", ".zip"]);
const imageTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export interface PreviewLimits {
  readonly maxTextBytes: number;
  readonly maxJsonBytes: number;
  readonly maxCsvBytes: number;
  readonly maxCsvRows: number;
  readonly maxImageBytes: number;
  readonly maxPdfBytes: number;
}

export type PreviewErrorCode =
  | "PATH_OUTSIDE_WORKSPACE"
  | "SYMLINK_ESCAPE"
  | "FILE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "FILE_TOO_LARGE"
  | "INVALID_JSON"
  | "INVALID_CSV"
  | "RESOURCE_INVALID"
  | "RESOURCE_EXPIRED"
  | "RESOURCE_STALE"
  | "RESOURCE_UNAUTHORIZED"
  | "UNSUPPORTED_PREVIEW"
  | "PROVIDER_UNAVAILABLE";

export class PreviewPanelError extends Error {
  readonly code: PreviewErrorCode;

  constructor(code: PreviewErrorCode, message: string = code) {
    super(message);
    this.name = "PreviewPanelError";
    this.code = code;
  }
}

export interface PreviewErrorDescriptor {
  readonly type: "error";
  readonly code: PreviewErrorCode;
  readonly message: string;
}

export interface TextPreviewDescriptor {
  readonly type: "text";
  readonly path: WorkspacePath;
  readonly renderer: "ui-primitives";
  readonly language?: string;
  readonly content: string;
  readonly truncated: boolean;
}

export interface MarkdownPreviewDescriptor {
  readonly type: "markdown";
  readonly path: WorkspacePath;
  readonly renderer: "ui-primitives";
  readonly content: string;
  readonly truncated: boolean;
  readonly policy: {
    readonly allowRawHtml: false;
    readonly allowRemoteImages: false;
    readonly allowedLinkSchemes: readonly ["http", "https", "mailto"];
  };
}

export interface JsonPreviewDescriptor {
  readonly type: "json";
  readonly path: WorkspacePath;
  readonly renderer: "ui-primitives";
  readonly value: unknown;
}

export interface CsvPreviewDescriptor {
  readonly type: "csv";
  readonly path: WorkspacePath;
  readonly renderer: "ui-primitives";
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly truncated: boolean;
}

export interface BinaryPreviewDescriptor {
  readonly type: "binary";
  readonly path: WorkspacePath;
  readonly mediaType: string;
  readonly resourceId: string;
  readonly version: string;
  readonly expiresAt: number;
}

export interface UnsupportedPreviewDescriptor {
  readonly type: "unsupported";
  readonly path: WorkspacePath;
  readonly reason: string;
  readonly mediaType?: string;
  readonly size?: number;
}

export type PreviewDescriptor =
  | TextPreviewDescriptor
  | MarkdownPreviewDescriptor
  | JsonPreviewDescriptor
  | CsvPreviewDescriptor
  | BinaryPreviewDescriptor
  | UnsupportedPreviewDescriptor
  | PreviewErrorDescriptor;

export interface ResourceRequest {
  readonly identity: WorkspaceIdentity;
  readonly mediaType?: string;
}

export interface OpenedResource {
  readonly mediaType: string;
  readonly version: string;
  readonly downloadName: string;
  readonly bytes: Uint8Array;
}

export interface BoundedTextRead {
  readonly path: WorkspacePath;
  readonly content: string;
  readonly bytes: number;
  readonly version: string;
  readonly loadedAt: number;
}

interface ResourceRecord {
  readonly identity: WorkspaceIdentity;
  readonly path: WorkspacePath;
  readonly mediaType: string;
  readonly version: string;
  readonly expiresAt: number;
  readonly downloadName: string;
}

interface ResolvedPath {
  readonly path: WorkspacePath;
  readonly canonicalPath: string;
}

interface FileRead {
  readonly bytes: Buffer;
  readonly size: number;
  readonly version: string;
}

function sameIdentity(left: WorkspaceIdentity, right: WorkspaceIdentity): boolean {
  return left.sessionId === right.sessionId && left.rootId === right.rootId;
}

function safeError(error: unknown): PreviewPanelError {
  if (error instanceof PreviewPanelError) return error;
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "ENOENT") return new PreviewPanelError("FILE_NOT_FOUND", "File is unavailable");
  if (code === "EACCES" || code === "EPERM") return new PreviewPanelError("PERMISSION_DENIED", "File access is denied");
  return new PreviewPanelError("PROVIDER_UNAVAILABLE", "Preview provider is unavailable");
}

function descriptorError(error: unknown): PreviewErrorDescriptor {
  const safe = safeError(error);
  return { type: "error", code: safe.code, message: safe.message };
}

function languageFor(path: WorkspacePath): string | undefined {
  const extension = extname(path).toLowerCase();
  return {
    ".css": "css",
    ".html": "html",
    ".js": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".py": "python",
    ".rs": "rust",
    ".sh": "shell",
    ".sql": "sql",
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".yaml": "yaml",
    ".yml": "yaml",
  }[extension];
}

function mediaTypeFor(path: WorkspacePath): string | undefined {
  const extension = extname(path).toLowerCase();
  if (imageTypes[extension]) return imageTypes[extension];
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".json") return "application/json";
  if (extension === ".csv") return "text/csv";
  if (extension === ".md") return "text/markdown";
  if (binaryExtensions.has(extension)) return "application/octet-stream";
  return "text/plain";
}

function resourceName(path: WorkspacePath, mediaType: string): string {
  const raw = basename(path).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, "_").replace(/[^\x20-\x7e]/gu, "_").trim().replace(/^[. ]+|[. ]+$/gu, "");
  if (raw) return raw.slice(0, 180);
  return mediaType === "application/pdf" ? "workspace-download.pdf" : "workspace-download.bin";
}

function versionFor(info: { readonly size: number; readonly mtimeMs: number; readonly ctimeMs: number; readonly ino?: number }): string {
  return `${info.size}:${info.mtimeMs}:${info.ctimeMs}:${info.ino ?? 0}`;
}

function boundedLimit(value: unknown, fallback: number, ceiling: number): number {
  return Number.isSafeInteger(value) && (value as number) > 0 ? Math.min(value as number, ceiling) : fallback;
}

function resolveLimits(overrides: Partial<PreviewLimits> | undefined): PreviewLimits {
  return {
    maxTextBytes: boundedLimit(overrides?.maxTextBytes, defaultLimits.maxTextBytes, hardLimits.maxTextBytes),
    maxJsonBytes: boundedLimit(overrides?.maxJsonBytes, defaultLimits.maxJsonBytes, hardLimits.maxJsonBytes),
    maxCsvBytes: boundedLimit(overrides?.maxCsvBytes, defaultLimits.maxCsvBytes, hardLimits.maxCsvBytes),
    maxCsvRows: boundedLimit(overrides?.maxCsvRows, defaultLimits.maxCsvRows, hardLimits.maxCsvRows),
    maxImageBytes: boundedLimit(overrides?.maxImageBytes, defaultLimits.maxImageBytes, hardLimits.maxImageBytes),
    maxPdfBytes: boundedLimit(overrides?.maxPdfBytes, defaultLimits.maxPdfBytes, hardLimits.maxPdfBytes),
  };
}

function resolveResourceTtl(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : defaultResourceTtlMs;
}

async function readHandle(handle: FileHandle, maxBytes: number, expectedVersion?: string): Promise<FileRead> {
  const info = await handle.stat();
  if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Preview target is not a file");
  const initialVersion = versionFor(info);
  if (expectedVersion !== undefined && initialVersion !== expectedVersion) throw new PreviewPanelError("RESOURCE_STALE", "Resource is stale");
  const bytes = Buffer.alloc(Math.min(info.size, maxBytes + 1));
  const result = await handle.read(bytes, 0, bytes.length, 0);
  const after = await handle.stat();
  if (versionFor(after) !== initialVersion) throw new PreviewPanelError("RESOURCE_STALE", "Preview changed during read");
  return { bytes: bytes.subarray(0, result.bytesRead), size: after.size, version: initialVersion };
}

async function readBounded(path: string, maxBytes: number, expectedCanonicalPath: string, expectedVersion?: string): Promise<FileRead> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, "r");
    if (await realpath(path) !== expectedCanonicalPath) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
    const read = await readHandle(handle, maxBytes, expectedVersion);
    try {
      if (await realpath(path) !== expectedCanonicalPath) throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
    } catch (error) {
      if (error instanceof PreviewPanelError) throw error;
      throw new PreviewPanelError("RESOURCE_STALE", "Workspace Path changed during read");
    }
    return read;
  } finally {
    await handle?.close();
  }
}

function textFrom(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function inspectJson(value: unknown, depth = 0, state = { nodes: 0 }): void {
  state.nodes += 1;
  if (depth > 64 || state.nodes > 10_000) throw new PreviewPanelError("INVALID_JSON", "JSON structure exceeds its safety limit");
  if (Array.isArray(value)) {
    for (const item of value) inspectJson(item, depth + 1, state);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) inspectJson(item, depth + 1, state);
  }
}

function parseCsv(text: string, maxRows: number): { columns: string[]; rows: string[][]; truncated: boolean } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let truncated = false;
  const pushRow = () => {
    if (row.length > 256 || cell.length > mib) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
    row.push(cell);
    cell = "";
    if (rows.length < maxRows + 1) rows.push(row);
    else truncated = true;
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') index += 1;
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") {
      if (row.length >= 256) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
      row.push(cell); cell = "";
    } else if (character === "\n") pushRow();
    else if (character !== "\r") cell += character;
    if (cell.length > mib) throw new PreviewPanelError("INVALID_CSV", "CSV structure exceeds its safety limit");
  }
  if (quoted) throw new PreviewPanelError("INVALID_CSV", "CSV contains an unclosed quote");
  if (cell.length > 0 || row.length > 0) pushRow();
  const columns = rows.shift() ?? [];
  return { columns, rows: rows.slice(0, maxRows), truncated: truncated || rows.length > maxRows };
}

export class PreviewService {
  private readonly root: string;
  readonly identity: WorkspaceIdentity;
  private readonly limits: PreviewLimits;
  private readonly resourceTtlMs: number;
  private readonly now: () => number;
  private readonly resources = new Map<string, ResourceRecord>();
  private disposed = false;

  constructor(
    root: string,
    identity: WorkspaceIdentity,
    options: { readonly limits?: Partial<PreviewLimits>; readonly resourceTtlMs?: number; readonly now?: () => number } = {},
  ) {
    this.root = root;
    this.identity = identity;
    this.limits = resolveLimits(options.limits);
    this.resourceTtlMs = resolveResourceTtl(options.resourceTtlMs);
    this.now = options.now ?? Date.now;
  }

  async preview(pathInput: string): Promise<PreviewDescriptor> {
    try {
      const resolved = await this.resolve(pathInput);
      const extension = extname(resolved.path).toLowerCase();
      if (extension === ".svg") return { type: "unsupported", path: resolved.path, reason: "svg-sanitization-required", mediaType: "image/svg+xml" };
      if (imageTypes[extension] || extension === ".pdf") return await this.binary(resolved);
      if (binaryExtensions.has(extension)) {
        const info = await stat(resolved.canonicalPath);
        return { type: "unsupported", path: resolved.path, reason: "unsupported-binary", mediaType: "application/octet-stream", size: info.size };
      }
      if (extension === ".json") return await this.json(resolved);
      if (extension === ".csv") return await this.csv(resolved);
      const read = await readBounded(resolved.canonicalPath, this.limits.maxTextBytes, resolved.canonicalPath);
      return {
        type: extension === ".md" ? "markdown" : "text",
        path: resolved.path,
        renderer: "ui-primitives",
        ...(extension === ".md" ? {
          content: textFrom(read.bytes.subarray(0, this.limits.maxTextBytes)),
          truncated: read.size > this.limits.maxTextBytes,
          policy: { allowRawHtml: false as const, allowRemoteImages: false as const, allowedLinkSchemes: ["http", "https", "mailto"] as const },
        } : {
          language: languageFor(resolved.path), content: textFrom(read.bytes.subarray(0, this.limits.maxTextBytes)), truncated: read.size > this.limits.maxTextBytes,
        }),
      } as PreviewDescriptor;
    } catch (error) {
      return descriptorError(error);
    }
  }

  /** Read one bounded text file with canonical containment and before/after version checks. */
  async readText(pathInput: string, maxBytes: number, signal?: AbortSignal): Promise<BoundedTextRead> {
    if (this.disposed) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new PreviewPanelError("FILE_TOO_LARGE", "Read limit is invalid");
    signal?.throwIfAborted();
    const resolved = await this.resolve(pathInput);
    signal?.throwIfAborted();
    const read = await readBounded(resolved.canonicalPath, maxBytes, resolved.canonicalPath);
    signal?.throwIfAborted();
    if (read.size > maxBytes) throw new PreviewPanelError("FILE_TOO_LARGE", "Context item exceeds its safety limit");
    return {
      path: resolved.path,
      content: textFrom(read.bytes),
      bytes: read.size,
      version: read.version,
      loadedAt: this.now(),
    };
  }

  async openResource(resourceId: string, request: ResourceRequest): Promise<OpenedResource> {
    if (this.disposed) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
    const resource = this.resources.get(resourceId);
    if (!resource) throw new PreviewPanelError("RESOURCE_INVALID", "Resource is invalid");
    if (!sameIdentity(resource.identity, request.identity)) throw new PreviewPanelError("RESOURCE_UNAUTHORIZED", "Resource is not authorized");
    if (this.now() >= resource.expiresAt) {
      this.resources.delete(resourceId);
      throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
    }
    if (request.mediaType !== undefined && request.mediaType !== resource.mediaType) throw new PreviewPanelError("RESOURCE_UNAUTHORIZED", "Resource type is not authorized");
    try {
      const resolved = await this.resolve(resource.path);
      const info = await stat(resolved.canonicalPath);
      if (versionFor(info) !== resource.version) throw new PreviewPanelError("RESOURCE_STALE", "Resource is stale");
      if (mediaTypeFor(resolved.path) !== resource.mediaType) throw new PreviewPanelError("RESOURCE_STALE", "Resource type is stale");
      const limit = resource.mediaType === "application/pdf" ? this.limits.maxPdfBytes : this.limits.maxImageBytes;
      if (info.size > limit) throw new PreviewPanelError("FILE_TOO_LARGE", "Preview exceeds its safety limit");
      const read = await readBounded(resolved.canonicalPath, limit, resolved.canonicalPath, resource.version);
      if (read.size > limit) throw new PreviewPanelError("FILE_TOO_LARGE", "Preview exceeds its safety limit");
      if (this.disposed || this.resources.get(resourceId) !== resource || this.now() >= resource.expiresAt) {
        this.resources.delete(resourceId);
        throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
      }
      return { mediaType: resource.mediaType, version: resource.version, downloadName: resource.downloadName, bytes: read.bytes };
    } catch (error) {
      throw safeError(error);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.resources.clear();
  }

  private async resolve(pathInput: string): Promise<ResolvedPath> {
    let path: WorkspacePath;
    try {
      path = normalizeWorkspacePath(pathInput);
    } catch {
      throw new PreviewPanelError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
    }
    if (!path) throw new PreviewPanelError("PATH_OUTSIDE_WORKSPACE", "Workspace Path is invalid");
    const root = await realpath(this.root);
    const candidate = join(root, path);
    const canonicalPath = await realpath(candidate);
    const relativePath = relative(root, canonicalPath);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
      throw new PreviewPanelError("SYMLINK_ESCAPE", "Workspace Path escapes its root");
    }
    return { path, canonicalPath };
  }

  private async binary(resolved: ResolvedPath): Promise<BinaryPreviewDescriptor> {
    const info = await stat(resolved.canonicalPath);
    if (!info.isFile()) throw new PreviewPanelError("PROVIDER_UNAVAILABLE", "Preview target is not a file");
    const mediaType = mediaTypeFor(resolved.path)!;
    const limit = mediaType === "application/pdf" ? this.limits.maxPdfBytes : this.limits.maxImageBytes;
    if (info.size > limit) throw new PreviewPanelError("FILE_TOO_LARGE", "Preview exceeds its safety limit");
    if (this.disposed) throw new PreviewPanelError("RESOURCE_EXPIRED", "Resource is expired");
    const resourceId = randomBytes(18).toString("base64url");
    const expiresAt = this.now() + this.resourceTtlMs;
    this.resources.set(resourceId, { identity: this.identity, path: resolved.path, mediaType, version: versionFor(info), expiresAt, downloadName: resourceName(resolved.path, mediaType) });
    return { type: "binary", path: resolved.path, mediaType, resourceId, version: versionFor(info), expiresAt };
  }

  private async json(resolved: ResolvedPath): Promise<JsonPreviewDescriptor> {
    const info = await stat(resolved.canonicalPath);
    if (info.size > this.limits.maxJsonBytes) throw new PreviewPanelError("FILE_TOO_LARGE", "JSON preview exceeds its safety limit");
    const read = await readBounded(resolved.canonicalPath, this.limits.maxJsonBytes, resolved.canonicalPath);
    try {
      const value = JSON.parse(textFrom(read.bytes)) as unknown;
      inspectJson(value);
      return { type: "json", path: resolved.path, renderer: "ui-primitives", value };
    } catch (error) {
      if (error instanceof PreviewPanelError) throw error;
      throw new PreviewPanelError("INVALID_JSON", "JSON content is invalid");
    }
  }

  private async csv(resolved: ResolvedPath): Promise<CsvPreviewDescriptor> {
    const info = await stat(resolved.canonicalPath);
    if (info.size > this.limits.maxCsvBytes) throw new PreviewPanelError("FILE_TOO_LARGE", "CSV preview exceeds its safety limit");
    const read = await readBounded(resolved.canonicalPath, this.limits.maxCsvBytes, resolved.canonicalPath);
    const parsed = parseCsv(textFrom(read.bytes), this.limits.maxCsvRows);
    return { type: "csv", path: resolved.path, renderer: "ui-primitives", ...parsed };
  }
}
