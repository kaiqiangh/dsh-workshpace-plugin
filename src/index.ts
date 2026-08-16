import { Remote, TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, PinnedContextRemoteSnapshot, WorkspaceArtifactPreview, WorkspaceDeliverable } from "./types.ts";
import { resolveWorkspaceRoot, resumeWorkspace, startWorkspace, type WorkspaceSnapshot } from "./domain/workspace.ts";
import { WorkspaceMemoryDomain, type MemoryScopeRequest } from "./domain/memory.ts";
import type { MemoryGovernanceAction } from "./domain/memory-governance.ts";
import { MemoryStoreError, type MemoryDraft, type MemoryListOptions, type MemoryReadState, type MemoryRecord, type MemorySearchOptions } from "./domain/memory-store.ts";
import { gitDiff as gitDiffForRoot, gitStatus as gitStatusForRoot, GitError, type GitChange, type GitDiffResult } from "./domain/git.ts";
import { sessionToolRecords, WorkspaceArtifactCarrier } from "./host/workspace-artifacts.ts";
import { registerMemoryPropose } from "./host/workspace-memory-propose.ts";
import { attachWorkspaceSummaryEmitter } from "./host/workspace-summary.ts";
import { registerWorkspaceResourceRoute, type WebRouteRegistrar } from "./host/workspace-resource.ts";

export {
  MEMORY_MAX_CONTENT_BYTES,
  MEMORY_MAX_FILE_BYTES,
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
  type MemoryMigration,
  type MemoryConfidence,
  type MemoryGovernance,
  type MemoryOrigin,
  type MemoryRetention,
  type MemorySourceRef,
  type MemoryVerification,
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
  type MemoryContentHash,
} from "./domain/memory-store.ts";
export { WorkspaceMemoryDomain, workspaceMemoryContextFor, type MemoryHostAgent, type MemoryScopeRequest, type MemoryWorkspaceContext } from "./domain/memory.ts";
export {
  assertMemoryRevision,
  conflictGroupFor,
  exportMemoryBundle,
  importMemoryBundle,
  memoryGovernance,
  memoryGovernanceEligible,
  MemoryGovernanceError,
  sourceRef,
  transitionMemoryGovernance,
} from "./domain/memory-governance.ts";

export { createPinnedContext, pinContextPath, setContextCapacity, updateContextPath } from "./domain/context.ts";
export { MEMORY_TYPES } from "./types.ts";
export { GitError, gitDiff, gitStatus, isGitRepository, parsePorcelain, GIT_MAX_DIFF_BYTES, type GitChange, type GitChangeStatus, type GitDiffResult, type GitErrorCode } from "./domain/git.ts";
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
export {
  createMemoryProposeTool,
  proposeMemory,
  registerMemoryPropose,
  MEMORY_PROPOSE_SECTION,
  MEMORY_PROPOSE_TOOL_NAME,
  type MemoryProposeArgs,
} from "./host/workspace-memory-propose.ts";
export {
  attachWorkspaceSummaryEmitter,
  workspaceSummaryFor,
  type SummaryAgent,
  type WorkspaceSummaryData,
} from "./host/workspace-summary.ts";

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

export interface WorkspaceServiceConfig {
  readonly memoryDomain?: WorkspaceMemoryDomain;
}

export class WorkspaceService extends TypertRemoteService {
  static inject = ["agents"] as const;
  private snapshot: PinnedContextRemoteSnapshot = emptySnapshot;
  private readonly memoryDomain: WorkspaceMemoryDomain;
  private readonly memoryWorkspaceSnapshots = new Map<string, WorkspaceSnapshot>();
  private artifactCarrier?: WorkspaceArtifactCarrier;
  private artifactAgentId?: string;
  private artifactRouteDispose?: () => void | Promise<void>;

  constructor(ctx: Context, config: WorkspaceServiceConfig = {}) {
    super(ctx, "workspace");
    this.memoryDomain = config.memoryDomain ?? new WorkspaceMemoryDomain();
    ctx.effect(() => () => {
      void this.memoryDomain.dispose();
      this.artifactRouteDispose?.();
      this.artifactRouteDispose = undefined;
      this.artifactCarrier?.dispose();
      this.artifactCarrier = undefined;
      this.artifactAgentId = undefined;
      this.memoryWorkspaceSnapshots.clear();
    }, "workspace artifact carrier");
  }

  @Remote
  summary(agent: AgentId): { readonly ready: boolean; readonly agent: AgentId } {
    return { ready: true, agent };
  }

  @Remote("focus")
  focus(agentId: AgentId): { readonly focused: boolean } {
    return { focused: true };
  }

  @Remote("contextSnapshot")
  contextSnapshot(agentId: AgentId): PinnedContextRemoteSnapshot {
    return this.snapshot;
  }

  @Remote("replaceContext")
  replaceContext(agentId: AgentId, snapshot: PinnedContextRemoteSnapshot): PinnedContextRemoteSnapshot {
    this.snapshot = validateSnapshot(snapshot);
    return this.snapshot;
  }

  @Remote("artifactMetadata")
  async artifactMetadata(agentId: AgentId): Promise<readonly WorkspaceDeliverable[]> {
    return (await this.carrier(this.agent(agentId)))?.metadata() ?? [];
  }

  @Remote("previewArtifact")
  async previewArtifact(agentId: AgentId, id: string): Promise<WorkspaceArtifactPreview> {
    const carrier = await this.carrier(this.agent(agentId));
    return carrier ? carrier.previewArtifact(id) : { type: "error", code: "PROVIDER_UNAVAILABLE", message: "Workspace artifact carrier is unavailable" };
  }

  @Remote("memoryOpen")
  async memoryOpen(agentId: AgentId, request: MemoryScopeRequest): Promise<MemoryReadState> {
    return this.memoryDomain.open(this.memoryContext(this.agent(agentId), request), request);
  }

  @Remote("memoryList")
  async memoryList(agentId: AgentId, request: MemoryScopeRequest, options?: MemoryListOptions): Promise<readonly MemoryRecord[]> {
    return this.memoryDomain.list(this.memoryContext(this.agent(agentId), request), request, options ?? {});
  }

  @Remote("memoryUpsert")
  async memoryUpsert(agentId: AgentId, request: MemoryScopeRequest, draft: MemoryDraft): Promise<MemoryRecord> {
    return this.memoryDomain.upsert(this.memoryContext(this.agent(agentId), request), request, draft);
  }

  @Remote("memoryArchive")
  async memoryArchive(agentId: AgentId, request: MemoryScopeRequest, id: string, expectedRevision: number, expectedHash: string): Promise<MemoryRecord> {
    return this.memoryDomain.govern(this.memoryContext(this.agent(agentId), request), request, id, "archive", expectedRevision, expectedHash);
  }

  @Remote("memoryForget")
  async memoryForget(agentId: AgentId, request: MemoryScopeRequest, id: string, expectedRevision: number, expectedHash: string): Promise<MemoryRecord> {
    return this.memoryDomain.govern(this.memoryContext(this.agent(agentId), request), request, id, "forget", expectedRevision, expectedHash);
  }

  @Remote("memorySearch")
  async memorySearch(agentId: AgentId, request: MemoryScopeRequest, query: string, options?: MemorySearchOptions): Promise<readonly MemoryRecord[]> {
    return this.memoryDomain.search(this.memoryContext(this.agent(agentId), request), request, query, options ?? {});
  }

  @Remote("memoryMarkUsed")
  async memoryMarkUsed(agentId: AgentId, request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    return this.memoryDomain.markUsed(this.memoryContext(this.agent(agentId), request), request, id);
  }

  @Remote("memoryGovern")
  async memoryGovern(agentId: AgentId, request: MemoryScopeRequest, id: string, action: MemoryGovernanceAction, expectedRevision: number, expectedHash: string): Promise<MemoryRecord> {
    return this.memoryDomain.govern(this.memoryContext(this.agent(agentId), request), request, id, action, expectedRevision, expectedHash);
  }

  @Remote("memoryExport")
  async memoryExport(agentId: AgentId, request: MemoryScopeRequest): Promise<string> {
    return this.memoryDomain.export(this.memoryContext(this.agent(agentId), request), request);
  }

  @Remote("memoryImport")
  async memoryImport(agentId: AgentId, request: MemoryScopeRequest, serialized: string): Promise<readonly MemoryRecord[]> {
    return this.memoryDomain.import(this.memoryContext(this.agent(agentId), request), request, serialized);
  }

  @Remote("memoryClose")
  async memoryClose(agentId: AgentId, request: MemoryScopeRequest): Promise<void> {
    return this.memoryDomain.close(this.memoryContext(this.agent(agentId), request), request);
  }

  @Remote("gitStatus")
  async gitStatus(agentId: AgentId): Promise<readonly GitChange[]> {
    return gitStatusForRoot(this.rootFor(this.agent(agentId)));
  }

  @Remote("gitDiff")
  async gitDiff(agentId: AgentId, path?: string): Promise<GitDiffResult> {
    return gitDiffForRoot(this.rootFor(this.agent(agentId)), path);
  }

  private rootFor(agent: Agent): string {
    const cwd = agent.session?.header?.cwd;
    if (!cwd) throw new GitError("GIT_UNAVAILABLE", "Workspace Session is unavailable");
    return resolveWorkspaceRoot(cwd, ".");
  }

  private agent(agentId: AgentId): Agent {
    const agent = this.ctx.agents.get(agentId);
    if (!agent) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
    return agent;
  }

  private memoryContext(agent: Agent, request: MemoryScopeRequest): { readonly identity: { readonly sessionId: string; readonly rootId: string }; readonly root?: string } {
    const cwd = agent.session?.header?.cwd;
    if (!cwd && request.scope === "user") return { identity: { sessionId: agent.id, rootId: "root:unavailable" } };
    if (!cwd) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Session is unavailable");
    try {
      const existingSnapshot = this.memoryWorkspaceSnapshots.get(agent.id);
      const snapshot = existingSnapshot
        ? resumeWorkspace({ snapshot: existingSnapshot, sessionId: agent.id, processCwd: cwd })
        : startWorkspace({ sessionId: agent.id, processCwd: cwd });
      this.memoryWorkspaceSnapshots.set(agent.id, snapshot);
      return { identity: snapshot.identity, root: resolveWorkspaceRoot(cwd, ".") };
    } catch (error) {
      if (request.scope === "user") return { identity: { sessionId: agent.id, rootId: "root:unavailable" } };
      throw new MemoryStoreError("PROJECT_UNAVAILABLE", error instanceof Error ? error.message : "Workspace Root is unavailable");
    }
  }

  private async carrier(agent: Agent): Promise<WorkspaceArtifactCarrier | undefined> {
    const agentView = agent as Agent & {
      readonly session?: { readonly header?: { readonly cwd?: string }; readonly events?: readonly {
          readonly seq: number;
          readonly time?: number;
          readonly type: string;
          readonly data?: Record<string, unknown>;
      }[] };
    };
    const cwd = agentView.session?.header?.cwd;
    if (!cwd || typeof agent.id !== "string") return undefined;
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
        records: () => sessionToolRecords((agentView.session?.events ?? []) as readonly {
          readonly seq: number;
          readonly time?: number;
          readonly type: string;
          readonly data?: Record<string, unknown>;
        }[]),
      });
      this.artifactAgentId = agent.id;
      const webServer = this.ctx.get("webServer") as WebRouteRegistrar | undefined;
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

export const inject = ["tools", "systemPrompt"] as const;

export function apply(ctx: Context): void {
  const memoryDomain = new WorkspaceMemoryDomain();
  ctx.plugin(WorkspaceService, { memoryDomain });
  ctx.effect(() => registerMemoryPropose(ctx, memoryDomain), "dsh-workspace memory propose tool");
  ctx.effect(() => attachWorkspaceSummaryEmitter(ctx), "dsh-workspace summary emitter");
}
