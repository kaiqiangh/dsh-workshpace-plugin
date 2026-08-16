import { Remote, RemoteScope, TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, PinnedContextRemoteSnapshot, WorkspaceArtifactPreview, WorkspaceDeliverable } from "./types.ts";
import { resolveWorkspaceRoot, startWorkspace } from "./domain/workspace.ts";
import { WorkspaceMemoryDomain, type MemoryScopeRequest } from "./domain/memory.ts";
import { MemoryStoreError, type MemoryDraft, type MemoryListOptions, type MemoryReadState, type MemoryRecord, type MemorySearchOptions } from "./domain/memory-store.ts";
import { sessionToolRecords, WorkspaceArtifactCarrier } from "./host/workspace-artifacts.ts";
import { registerWorkspaceResourceRoute, type WebRouteRegistrar } from "./host/workspace-resource.ts";

export {
  MEMORY_MAX_CONTENT_BYTES,
  MEMORY_MAX_QUERY_BYTES,
  MEMORY_MAX_RESULTS,
  MEMORY_MAX_TAGS,
  MEMORY_MAX_TAG_BYTES,
  MEMORY_MAX_TITLE_BYTES,
  MEMORY_SCHEMA_VERSION,
  memoryStorePath,
  MemoryStore,
  MemoryStoreError,
  type MemoryDraft,
  type MemoryListOptions,
  type MemoryProvenance,
  type MemoryReadState,
  type MemoryRecord,
  type MemoryScope,
  type MemorySearchOptions,
  type MemoryStatus,
  type MemoryStoreErrorCode,
  type MemoryStoreLocationOptions,
  type MemoryStoreOptions,
  type MemoryStoreWarning,
  type MemoryType,
} from "./domain/memory-store.ts";
export { WorkspaceMemoryDomain, type MemoryScopeRequest, type MemoryWorkspaceContext } from "./domain/memory.ts";

export { createPinnedContext, pinContextPath, setContextCapacity, updateContextPath } from "./domain/context.ts";
export { registerPinnedContextCarrier } from "./domain/context-carrier.ts";
export {
  PreviewPanelError,
  PreviewService,
  type BinaryPreviewDescriptor,
  type BoundedTextRead,
  type CsvPreviewDescriptor,
  type JsonPreviewDescriptor,
  type MarkdownPreviewDescriptor,
  type OpenedResource,
  type PreviewDescriptor,
  type PreviewErrorCode,
  type PreviewErrorDescriptor,
  type PreviewLimits,
  type ResourceRequest,
  type TextPreviewDescriptor,
  type UnsupportedPreviewDescriptor,
} from "./domain/preview.ts";
export {
  createWorkspaceDeliverable,
  deliverableResourceId,
  safeDownloadName,
  WorkspaceDeliverableError,
  type WorkspaceDeliverable,
  type WorkspaceDeliverableOptions,
  type WorkspaceDeliverablePreview,
  type WorkspaceDeliverableSource,
} from "./domain/deliverable.ts";
export {
  installWorkspaceResourceRoute,
  registerWorkspaceResourceRoute,
  type WebRouteRegistrar,
  type WorkspaceEffectRegistrar,
  type WorkspaceResourceRouteOptions,
} from "./host/workspace-resource.ts";
export {
  WorkspaceArtifactCarrier,
  sessionToolRecords,
  type WorkspaceArtifactCarrierOptions,
  type WorkspaceArtifactPreview,
  type SessionEventLike,
} from "./host/workspace-artifacts.ts";

declare module "@deepseek-ai/dsh-typert-protocol" {
  interface TypertContextMap {
    agent: TypertContext<AgentId>;
  }
}

const emptySnapshot: PinnedContextRemoteSnapshot = Object.freeze({
  version: 0,
  contentHash: "sha256:" + "0".repeat(64),
  estimatedTokens: 0,
  capacityTokens: 0,
  admittedTokens: 0,
  availableBudgetTokens: 0,
  remainingTokens: 0,
  status: "omitted",
  omissionReason: "empty",
});

function validateSnapshot(snapshot: PinnedContextRemoteSnapshot): PinnedContextRemoteSnapshot {
  if (!snapshot || typeof snapshot !== "object"
    || !Number.isSafeInteger(snapshot.version) || snapshot.version < 0
    || typeof snapshot.contentHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(snapshot.contentHash)
    || !Number.isSafeInteger(snapshot.estimatedTokens) || snapshot.estimatedTokens < 0
    || !Number.isSafeInteger(snapshot.capacityTokens) || snapshot.capacityTokens < 0
    || !Number.isSafeInteger(snapshot.admittedTokens) || snapshot.admittedTokens < 0
    || !Number.isSafeInteger(snapshot.availableBudgetTokens) || snapshot.availableBudgetTokens < 0
    || !Number.isSafeInteger(snapshot.remainingTokens) || snapshot.remainingTokens < 0
    || (snapshot.status !== "ready" && snapshot.status !== "omitted")
    || typeof snapshot.omissionReason !== "string" || /[\u0000-\u001f\u007f]/u.test(snapshot.omissionReason)
    || snapshot.availableBudgetTokens > snapshot.capacityTokens
    || snapshot.admittedTokens > snapshot.availableBudgetTokens
    || snapshot.remainingTokens !== snapshot.availableBudgetTokens - snapshot.admittedTokens
    || snapshot.estimatedTokens < snapshot.admittedTokens
    || (snapshot.status === "ready" && snapshot.omissionReason !== "")) {
    throw new Error("Pinned Context snapshot is invalid");
  }
  return Object.freeze({
    version: snapshot.version,
    contentHash: snapshot.contentHash,
    estimatedTokens: snapshot.estimatedTokens,
    capacityTokens: snapshot.capacityTokens,
    admittedTokens: snapshot.admittedTokens,
    availableBudgetTokens: snapshot.availableBudgetTokens,
    remainingTokens: snapshot.remainingTokens,
    status: snapshot.status,
    omissionReason: snapshot.omissionReason,
  });
}

export class WorkspaceService extends TypertRemoteService {
  private snapshot: PinnedContextRemoteSnapshot = emptySnapshot;
  private readonly memoryDomain = new WorkspaceMemoryDomain();
  private artifactCarrier?: WorkspaceArtifactCarrier;
  private artifactAgentId?: string;
  private artifactRouteDispose?: () => void | Promise<void>;

  constructor(ctx: Context) {
    super(ctx, "workspace");
    ctx.effect(() => () => {
      void this.memoryDomain.dispose();
      this.artifactRouteDispose?.();
      this.artifactRouteDispose = undefined;
      this.artifactCarrier?.dispose();
      this.artifactCarrier = undefined;
      this.artifactAgentId = undefined;
    }, "workspace artifact carrier");
  }

  @Remote
  summary(agent: AgentId): { readonly ready: boolean; readonly agent: AgentId } {
    return { ready: true, agent };
  }

  @RemoteScope("agent")
  focus(): { readonly focused: boolean } {
    return { focused: true };
  }

  @RemoteScope("agent")
  contextSnapshot(): PinnedContextRemoteSnapshot {
    return this.snapshot;
  }

  @RemoteScope("agent")
  replaceContext(snapshot: PinnedContextRemoteSnapshot): PinnedContextRemoteSnapshot {
    this.snapshot = validateSnapshot(snapshot);
    return this.snapshot;
  }

  @RemoteScope("agent")
  async artifactMetadata(): Promise<readonly WorkspaceDeliverable[]> {
    return (await this.carrier())?.metadata() ?? [];
  }

  @RemoteScope("agent")
  async previewArtifact(id: string): Promise<WorkspaceArtifactPreview> {
    const carrier = await this.carrier();
    return carrier ? carrier.previewArtifact(id) : { type: "error", code: "PROVIDER_UNAVAILABLE", message: "Workspace artifact carrier is unavailable" };
  }

  @RemoteScope("agent")
  async memoryOpen(request: MemoryScopeRequest): Promise<MemoryReadState> {
    return this.memoryDomain.open(this.memoryContext(request), request);
  }

  @RemoteScope("agent")
  async memoryList(request: MemoryScopeRequest, options?: MemoryListOptions): Promise<readonly MemoryRecord[]> {
    return this.memoryDomain.list(this.memoryContext(request), request, options ?? {});
  }

  @RemoteScope("agent")
  async memoryUpsert(request: MemoryScopeRequest, draft: MemoryDraft): Promise<MemoryRecord> {
    return this.memoryDomain.upsert(this.memoryContext(request), request, draft);
  }

  @RemoteScope("agent")
  async memoryArchive(request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    return this.memoryDomain.archive(this.memoryContext(request), request, id);
  }

  @RemoteScope("agent")
  async memoryForget(request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    return this.memoryDomain.forget(this.memoryContext(request), request, id);
  }

  @RemoteScope("agent")
  async memorySearch(request: MemoryScopeRequest, query: string, options?: MemorySearchOptions): Promise<readonly MemoryRecord[]> {
    return this.memoryDomain.search(this.memoryContext(request), request, query, options ?? {});
  }

  @RemoteScope("agent")
  async memoryMarkUsed(request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    return this.memoryDomain.markUsed(this.memoryContext(request), request, id);
  }

  @RemoteScope("agent")
  async memoryClose(request: MemoryScopeRequest): Promise<void> {
    return this.memoryDomain.close(this.memoryContext(request), request);
  }

  private memoryContext(request: MemoryScopeRequest): { readonly identity: { readonly sessionId: string; readonly rootId: string }; readonly root?: string } {
    const scoped = this.ctx as Context & { readonly agent?: { readonly id: AgentId; readonly session?: { readonly header?: { readonly cwd?: string } } } };
    const cwd = scoped.agent?.session?.header?.cwd;
    if (!scoped.agent) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
    if (!cwd && request.scope === "user") return { identity: { sessionId: scoped.agent.id, rootId: "root:unavailable" } };
    if (!cwd) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
    try {
      const root = resolveWorkspaceRoot(cwd, ".");
      return { identity: startWorkspace({ sessionId: scoped.agent.id, processCwd: cwd }).identity, root };
    } catch (error) {
      if (request.scope === "user") return { identity: { sessionId: scoped.agent.id, rootId: "root:unavailable" } };
      throw error;
    }
  }

  private async carrier(): Promise<WorkspaceArtifactCarrier | undefined> {
    const scoped = this.ctx as Context & { readonly webServer?: WebRouteRegistrar } & {
      readonly agent?: {
        readonly id: AgentId;
        readonly session?: { readonly header?: { readonly cwd?: string }; readonly events?: readonly {
          readonly seq: number;
          readonly time?: number;
          readonly type: string;
          readonly data?: Record<string, unknown>;
        }[] };
      };
    };
    const agent = scoped.agent;
    const cwd = agent?.session?.header?.cwd;
    if (!agent || !cwd || typeof agent.id !== "string") return undefined;
    if (this.artifactCarrier && this.artifactAgentId === agent.id) return this.artifactCarrier;
    this.artifactRouteDispose?.();
    this.artifactRouteDispose = undefined;
    this.artifactCarrier?.dispose();
    try {
      const root = resolveWorkspaceRoot(cwd, ".");
      const workspace = startWorkspace({ sessionId: agent.id, processCwd: cwd });
      this.artifactCarrier = new WorkspaceArtifactCarrier({
        workspace,
        root,
        records: () => sessionToolRecords((agent.session?.events ?? []) as readonly {
          readonly seq: number;
          readonly time?: number;
          readonly type: string;
          readonly data?: Record<string, unknown>;
        }[]),
      });
      this.artifactAgentId = agent.id;
      const webServer = scoped.webServer;
      if (webServer?.register) {
        const carrier = this.artifactCarrier;
        this.artifactRouteDispose = this.ctx.effect(
          () => registerWorkspaceResourceRoute(webServer, { preview: carrier.preview }),
          "workspace opaque artifact route",
        );
      }
      return this.artifactCarrier;
    } catch (error) {
      this.artifactRouteDispose?.();
      this.artifactRouteDispose = undefined;
      this.artifactCarrier?.dispose();
      this.artifactCarrier = undefined;
      this.artifactAgentId = undefined;
      throw error;
    }
  }
}

export const name = "dsh-workspace-plugin";

export function apply(ctx: Context): void {
  ctx.plugin(WorkspaceService);
}
