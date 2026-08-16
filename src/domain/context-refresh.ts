import { PreviewPanelError, type BoundedTextRead, type PreviewService } from "./preview.ts";
import {
  hashPinnedContextContent,
  renderPinnedContext,
  updateContextPath,
  type PinnedContextSourceStatus,
  type PinnedContextState,
} from "./context.ts";
import type { WorkspacePath } from "./workspace.ts";

export type PinnedContextRefreshReason = "activity" | "resume" | "assembly";

export interface PinnedContextReader {
  read(path: string, maxBytes: number, signal?: AbortSignal): Promise<BoundedTextRead>;
}

export interface PinnedContextRefreshResult {
  readonly state: PinnedContextState;
  readonly reason: PinnedContextRefreshReason;
  readonly changed: boolean;
  readonly cancelled: boolean;
  readonly refreshedPaths: readonly WorkspacePath[];
}

export type PinnedContextRefreshErrorCode = "DISPOSED" | "IDENTITY_MISMATCH";

export class PinnedContextRefreshError extends Error {
  readonly code: PinnedContextRefreshErrorCode;

  constructor(code: PinnedContextRefreshErrorCode, message: string) {
    super(message);
    this.name = "PinnedContextRefreshError";
    this.code = code;
  }
}

function sourceFailure(error: unknown): { status: Exclude<PinnedContextSourceStatus, "pending" | "ready">; reason: string } {
  if (error instanceof PreviewPanelError) {
    switch (error.code) {
      case "RESOURCE_STALE": return { status: "stale", reason: "Workspace file changed during read" };
      case "FILE_TOO_LARGE": return { status: "oversized", reason: "Workspace file exceeds the Pinned Context item limit" };
      case "UNSUPPORTED_PREVIEW": return { status: "unsupported", reason: "Workspace file type is unsupported for Pinned Context" };
      case "RESOURCE_EXPIRED": return { status: "stale", reason: "Workspace reader is disposed" };
      default: return { status: "unreadable", reason: "Workspace file is unavailable" };
    }
  }
  return { status: "unreadable", reason: "Workspace file could not be read" };
}

function sameIdentity(left: PinnedContextState, right: PinnedContextState): boolean {
  return left.identity.sessionId === right.identity.sessionId && left.identity.rootId === right.identity.rootId;
}

function unchangedFailure(state: PinnedContextState, path: string, status: string, reason: string): boolean {
  const entry = state.entries.find((item) => item.path === path);
  return entry?.sourceStatus === status && entry.reason === reason;
}

export function previewContextReader(preview: PreviewService): PinnedContextReader {
  return { read: (path, maxBytes, signal) => preview.readText(path, maxBytes, signal) };
}

export class PinnedContextRefreshController {
  private stateValue: PinnedContextState;
  private readonly reader: PinnedContextReader;
  private readonly publish?: (state: PinnedContextState) => void;
  private readonly pendingReasons = new Set<PinnedContextRefreshReason>();
  private generation = 0;
  private activeAbort?: AbortController;
  private disposed = false;

  constructor(
    state: PinnedContextState,
    reader: PinnedContextReader,
    options: { readonly publish?: (state: PinnedContextState) => void } = {},
  ) {
    this.stateValue = state;
    this.reader = reader;
    this.publish = options.publish;
  }

  get state(): PinnedContextState {
    return this.stateValue;
  }

  request(reason: PinnedContextRefreshReason): void {
    this.assertActive();
    this.pendingReasons.add(reason);
  }

  async flushAtAssembly(): Promise<PinnedContextRefreshResult> {
    this.assertActive();
    const reasons = [...this.pendingReasons];
    this.pendingReasons.clear();
    return this.refresh(reasons.includes("resume") ? "resume" : reasons.includes("activity") ? "activity" : "assembly");
  }

  restore(state: PinnedContextState): void {
    this.assertActive();
    if (!sameIdentity(this.stateValue, state)) {
      throw new PinnedContextRefreshError("IDENTITY_MISMATCH", "Pinned Context restore identity does not match");
    }
    const previousText = renderPinnedContext(this.stateValue).text;
    this.stateValue = state;
    if (previousText !== renderPinnedContext(state).text) this.publish?.(state);
  }

  async refresh(reason: PinnedContextRefreshReason): Promise<PinnedContextRefreshResult> {
    this.assertActive();
    const generation = ++this.generation;
    this.activeAbort?.abort();
    const controller = new AbortController();
    this.activeAbort = controller;
    const before = this.stateValue;
    let next = before;
    const refreshedPaths: WorkspacePath[] = [];
    try {
      for (const entry of before.entries) {
        if (this.isCancelled(generation, controller)) return this.cancelledResult(reason, refreshedPaths);
        try {
          const read = await this.reader.read(entry.path, before.limits.maxItemBytes, controller.signal);
          if (this.isCancelled(generation, controller)) return this.cancelledResult(reason, refreshedPaths);
          if (read.path !== entry.path || read.bytes > before.limits.maxItemBytes || !read.version.trim()) {
            throw new PreviewPanelError("RESOURCE_STALE", "Workspace reader returned inconsistent evidence");
          }
          const hash = hashPinnedContextContent(read.content);
          if (entry.sourceStatus === "ready" && entry.contentHash === hash) continue;
          next = updateContextPath(next, {
            path: entry.path,
            status: "ready",
            content: read.content,
            loadedAt: read.loadedAt,
          });
          refreshedPaths.push(entry.path);
        } catch (error) {
          if (this.isCancelled(generation, controller)) return this.cancelledResult(reason, refreshedPaths);
          const failure = sourceFailure(error);
          if (!unchangedFailure(next, entry.path, failure.status, failure.reason)) {
            next = updateContextPath(next, {
              path: entry.path,
              status: failure.status,
              reason: failure.reason,
              loadedAt: Date.now(),
            });
            refreshedPaths.push(entry.path);
          }
        }
      }
      if (this.isCancelled(generation, controller)) return this.cancelledResult(reason, refreshedPaths);
      const changed = renderPinnedContext(before).text !== renderPinnedContext(next).text;
      this.stateValue = next;
      if (changed) this.publish?.(next);
      return { state: next, reason, changed, cancelled: false, refreshedPaths };
    } finally {
      if (this.activeAbort === controller) this.activeAbort = undefined;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.activeAbort?.abort();
    this.activeAbort = undefined;
    this.pendingReasons.clear();
  }

  private assertActive(): void {
    if (this.disposed) throw new PinnedContextRefreshError("DISPOSED", "Pinned Context refresh is disposed");
  }

  private isCancelled(generation: number, controller: AbortController): boolean {
    return this.disposed || generation !== this.generation || controller.signal.aborted;
  }

  private cancelledResult(reason: PinnedContextRefreshReason, refreshedPaths: readonly WorkspacePath[]): PinnedContextRefreshResult {
    return { state: this.stateValue, reason, changed: false, cancelled: true, refreshedPaths };
  }
}
