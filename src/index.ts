import { Remote, RemoteScope, TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, PinnedContextRemoteSnapshot } from "./types.ts";

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

  constructor(ctx: Context) {
    super(ctx, "workspace");
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
}

export const name = "dsh-workspace-plugin";

export function apply(ctx: Context): void {
  ctx.plugin(WorkspaceService);
}
