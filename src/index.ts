import { Remote, TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, WorkspaceArtifactPreview, WorkspaceDeliverable, WorkspaceSummaryData } from "./types.ts";
import { resolveWorkspaceRoot, resumeWorkspace, startWorkspace, type WorkspaceSnapshot } from "./domain/workspace.ts";
import { WorkspaceMemoryDomain, type MemoryScopeRequest } from "./domain/memory.ts";
import type { MemoryGovernanceAction } from "./domain/memory-governance.ts";
import { MemoryStoreError, type MemoryDraft, type MemoryListOptions, type MemoryReadState, type MemoryRecord, type MemorySearchOptions } from "./domain/memory-store.ts";
import { gitCommit as gitCommitForRoot, gitDiff as gitDiffForRoot, gitHistory as gitHistoryForRoot, gitRepoInfo as gitRepoInfoForRoot, gitStatus as gitStatusForRoot, GitError, type GitChange, type GitCommit, type GitCommitResult, type GitDiffResult, type GitHistoryOptions, type GitRepoInfo } from "./domain/git.ts";
import { sessionToolRecords, WorkspaceArtifactCarrier, type SessionEventLike } from "./host/workspace-artifacts.ts";
import { registerMemoryPropose } from "./host/workspace-memory-propose.ts";
import { attachWorkspaceSummaryEmitter, workspaceSummaryWithMemory, type SummaryAgent } from "./host/workspace-summary.ts";
import { attachWorkspaceMemoryAutoWriter } from "./host/workspace-memory-auto-write.ts";
import { registerWorkspaceResourceRoute, registerWorkspaceVendorRoute, type WebRouteRegistrar } from "./host/workspace-resource.ts";

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
export { memoryLogicalLocation } from "./domain/memory-store.ts";
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

export { MEMORY_TYPES } from "./types.ts";
export { GitError, gitCommit, gitDiff, gitHistory, gitRepoInfo, gitStatus, isGitRepository, parsePorcelain, GIT_COMMIT_MAX_DIFF_BYTES, GIT_HISTORY_MAX_COMMITS, GIT_MAX_DIFF_BYTES, type GitChange, type GitChangeStatus, type GitCommit, type GitCommitFile, type GitCommitResult, type GitDiffResult, type GitErrorCode, type GitHistoryOptions, type GitHistoryScope, type GitRepoInfo } from "./domain/git.ts";
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
  installWorkspaceVendorRoute,
  registerWorkspaceResourceRoute,
  registerWorkspaceVendorRoute,
  type WebRouteRegistrar,
  type WorkspaceEffectRegistrar,
  type WorkspaceResourceRouteOptions,
  type WorkspaceVendorRouteOptions,
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
  workspaceSummaryWithMemory,
  type SummaryAgent,
  type WorkspaceSummaryData,
} from "./host/workspace-summary.ts";
export {
  attachWorkspaceMemoryAutoWriter,
  buildAutoFactContent,
  writeAutoFact,
  AUTO_FACT_TAGS,
  AUTO_FACT_TITLE,
  type AutoWriteAgent,
} from "./host/workspace-memory-auto-write.ts";

declare module "@deepseek-ai/dsh-typert-protocol" {
  interface TypertContextMap {
    agent: TypertContext<AgentId>;
  }
}

export interface WorkspaceServiceConfig {
  readonly memoryDomain?: WorkspaceMemoryDomain;
}

export class WorkspaceService extends TypertRemoteService {
  static inject = ["agents"] as const;
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

  /**
   * Derive the current session summary from allow-listed durable tool records
   * (tool/call + tool/result). Never writes a custom event to the session log:
   * persisting `workspace/summary` made the whole log unloadable after a
   * restart (cold-read rejects unknown non-ignorable event types).
   */
  @Remote("workspaceSummary")
  async workspaceSummary(agentId: AgentId): Promise<WorkspaceSummaryData | undefined> {
    const agent = this.ctx.agents.get(agentId) as (Agent & { readonly session?: { readonly header?: { readonly cwd?: string }; readonly events?: readonly { readonly seq: number; readonly type: string; readonly data?: Record<string, unknown> }[] } }) | undefined;
    if (!agent?.session) return undefined;
    const summaryAgent: SummaryAgent = {
      id: agentId,
      session: {
        header: { cwd: agent.session.header?.cwd },
        events: agent.session.events as readonly SessionEventLike[] | undefined,
      },
    };
    return workspaceSummaryWithMemory(summaryAgent, this.memoryDomain);
  }

  @Remote("focus")
  focus(agentId: AgentId): { readonly focused: boolean } {
    return { focused: true };
  }

  @Remote("artifactMetadata")
  async artifactMetadata(agentId: AgentId): Promise<readonly WorkspaceDeliverable[]> {
    // A missing/unregistered agent must degrade to the empty state (the web
    // surface shows "No session artifacts yet"), not throw PROJECT_UNAVAILABLE
    // which the surface renders as the misleading "artifacts are unavailable"
    // notice (wayfinder #120). Only a resolvable agent reaches the carrier.
    const agent = this.ctx.agents.get(agentId);
    if (!agent) return [];
    return (await this.carrier(agent))?.metadata() ?? [];
  }

  @Remote("previewArtifact")
  async previewArtifact(agentId: AgentId, id: string): Promise<WorkspaceArtifactPreview> {
    const agent = this.ctx.agents.get(agentId);
    if (!agent) return { type: "error", code: "PROVIDER_UNAVAILABLE", message: "Workspace artifact carrier is unavailable" };
    const carrier = await this.carrier(agent);
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

  @Remote("memoryExportMarkdown")
  async memoryExportMarkdown(agentId: AgentId, request: MemoryScopeRequest): Promise<string> {
    return this.memoryDomain.exportMarkdown(this.memoryContext(this.agent(agentId), request), request);
  }

  @Remote("memoryImportMarkdown")
  async memoryImportMarkdown(agentId: AgentId, request: MemoryScopeRequest, markdown: string): Promise<readonly MemoryRecord[]> {
    return this.memoryDomain.importMarkdown(this.memoryContext(this.agent(agentId), request), request, markdown);
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

  @Remote("gitHistory")
  async gitHistory(agentId: AgentId, options?: GitHistoryOptions): Promise<readonly GitCommit[]> {
    return gitHistoryForRoot(this.rootFor(this.agent(agentId)), options);
  }

  @Remote("gitCommit")
  async gitCommit(agentId: AgentId, sha: string): Promise<GitCommitResult> {
    return gitCommitForRoot(this.rootFor(this.agent(agentId)), sha);
  }

  @Remote("gitRepoInfo")
  async gitRepoInfo(agentId: AgentId): Promise<GitRepoInfo> {
    return gitRepoInfoForRoot(this.rootFor(this.agent(agentId)));
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
    // A session is bound to one Workspace Root: rebinding to a different root
    // must fail closed (PROJECT_UNAVAILABLE) rather than silently following the
    // new directory — see scripts/dsh-compat-smoke.mjs "must fail closed".
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
    // Key the carrier by session + working directory so a session whose cwd
    // moves to another workspace does not keep serving stale artifacts.
    const carrierKey = `${agent.id}\u0000${cwd}`;
    if (this.artifactCarrier && this.artifactAgentId === carrierKey) return this.artifactCarrier;
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
        }[], root),
      });
      this.artifactAgentId = carrierKey;
      const webServer = this.ctx.get("webServer") as WebRouteRegistrar | undefined;
      if (webServer?.register) {
        const carrier = this.artifactCarrier;
        this.artifactRouteDispose = this.ctx.effect(
          () => {
            const disposeResource = registerWorkspaceResourceRoute(webServer, { preview: carrier.preview });
            const disposeVendor = registerWorkspaceVendorRoute(webServer);
            return () => { disposeVendor(); disposeResource(); };
          },
          "workspace opaque artifact + vendor routes",
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
  ctx.effect(() => attachWorkspaceSummaryEmitter(ctx, memoryDomain), "dsh-workspace summary emitter");
  ctx.effect(() => attachWorkspaceMemoryAutoWriter(ctx, memoryDomain), "dsh-workspace memory auto-writer");
}
