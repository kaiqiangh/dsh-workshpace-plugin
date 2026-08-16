import { homedir } from "node:os";
import { join } from "node:path";

import {
  MemoryStore,
  MemoryStoreError,
  memoryStorePath,
  type MemoryDraft,
  type MemoryListOptions,
  type MemoryReadState,
  type MemoryRecord,
  type MemoryScope,
  type MemorySearchOptions,
  type MemoryStoreOptions,
} from "./memory-store.ts";
import { assertMemoryRevision, conflictGroupFor, exportMemoryBundle, importMemoryBundle, transitionMemoryGovernance, type MemoryGovernanceAction, MemoryGovernanceError } from "./memory-governance.ts";
import type { WorkspaceIdentity } from "./workspace.ts";

export interface MemoryScopeRequest {
  readonly scope: MemoryScope;
  /** Required for User scope; never interpreted as a filesystem path. */
  readonly userId?: string;
  /** Shared Project is opt-in and must be explicitly true. */
  readonly sharedProject?: boolean;
}

export interface MemoryWorkspaceContext {
  readonly identity: WorkspaceIdentity;
  readonly root?: string;
}

interface MemoryLocation {
  readonly key: string;
  readonly options: MemoryStoreOptions;
}

const scopeNames: readonly MemoryScope[] = ["session", "project", "user", "shared-project"];

function assertRequest(request: MemoryScopeRequest): void {
  if (!request || typeof request !== "object" || !scopeNames.includes(request.scope)) {
    throw new MemoryStoreError("INVALID_RECORD", "Memory scope request is invalid");
  }
  if (request.scope === "user") {
    if (typeof request.userId !== "string" || !request.userId.trim() || request.userId.length > 256 || /[\\/\u0000-\u001f\u007f]/u.test(request.userId)) {
      throw new MemoryStoreError("INVALID_RECORD", "User Memory id is invalid");
    }
    if (request.sharedProject === true) throw new MemoryStoreError("SCOPE_MISMATCH", "Shared Project opt-in does not apply to User Memory");
    return;
  }
  if (request.userId !== undefined) throw new MemoryStoreError("SCOPE_MISMATCH", "User Memory id does not apply to this scope");
  if (request.scope === "shared-project" && request.sharedProject !== true) throw new MemoryStoreError("SCOPE_MISMATCH", "Shared Project Memory requires explicit opt-in");
  if (request.scope !== "shared-project" && request.sharedProject === true) throw new MemoryStoreError("SCOPE_MISMATCH", "Shared Project opt-in does not apply to this scope");
}

function locationFor(context: MemoryWorkspaceContext, request: MemoryScopeRequest, dshHome: string): MemoryLocation {
  assertRequest(request);
  if (!context || !context.identity?.sessionId || !context.identity.rootId) {
    throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace identity is unavailable");
  }
  if ((request.scope === "project" || request.scope === "shared-project") && (typeof context.root !== "string" || !context.root.trim())) {
    throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Workspace Root is unavailable");
  }
  const scopeKey = request.scope === "session"
    ? `${context.identity.sessionId}|${context.identity.rootId}`
    : request.scope === "user" ? request.userId! : context.identity.rootId;
  const options: MemoryStoreOptions = {
    scope: request.scope,
    scopeKey,
    projectRoot: request.scope === "project" || request.scope === "shared-project" ? context.root : undefined,
    dshHome: request.scope === "session" || request.scope === "user" ? dshHome : undefined,
  };
  return { key: `${request.scope}:${scopeKey}:${memoryStorePath(options)}`, options };
}

export class WorkspaceMemoryDomain {
  private readonly stores = new Map<string, MemoryStore>();
  private readonly dshHome: string;

  constructor(dshHome = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh")) {
    this.dshHome = dshHome;
  }

  async open(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<MemoryReadState> {
    const location = locationFor(context, request, this.dshHome);
    let store = this.stores.get(location.key);
    if (!store) {
      store = new MemoryStore(location.options);
      this.stores.set(location.key, store);
    }
    return store.open();
  }

  async list(context: MemoryWorkspaceContext, request: MemoryScopeRequest, options: MemoryListOptions = {}): Promise<readonly MemoryRecord[]> {
    const store = await this.store(context, request);
    return store.list(options);
  }

  async upsert(context: MemoryWorkspaceContext, request: MemoryScopeRequest, draft: MemoryDraft): Promise<MemoryRecord> {
    const store = await this.store(context, request);
    const previous = draft.id === undefined ? undefined : ["active", "archived", "forgotten"].flatMap((status) => store.list({ status: status as MemoryRecord["status"], limit: 100 })).find((record) => record.id === draft.id);
    if (previous) {
      if (draft.expectedRevision === undefined || draft.expectedHash === undefined) throw new MemoryGovernanceError("CONFLICT", `Memory ${previous.id} requires a revision and content hash`);
      assertMemoryRevision(previous, draft.expectedRevision, draft.expectedHash);
    }
    const duplicate = draft.id === undefined && store.list({ status: "active", limit: 100 }).find((record) => record.title.trim().toLocaleLowerCase() === draft.title.trim().toLocaleLowerCase());
    const governance = duplicate ? {
      origin: "user-authored" as const,
      sourceRefs: [],
      verification: "unverified" as const,
      revision: 1,
      conflictGroup: conflictGroupFor(draft.title),
      retention: request.scope === "session" ? "session-end" as const : request.scope === "user" ? "user-managed" as const : "project-delete" as const,
    } : draft.governance;
    const { expectedRevision: _expectedRevision, expectedHash: _expectedHash, ...persisted } = draft;
    return store.upsert({ ...persisted, ...(governance === undefined ? {} : { governance }) });
  }

  async archive(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    const store = await this.store(context, request);
    return store.archive(id);
  }

  async forget(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    const store = await this.store(context, request);
    return store.forget(id);
  }

  async search(context: MemoryWorkspaceContext, request: MemoryScopeRequest, query: string, options: MemorySearchOptions = {}): Promise<readonly MemoryRecord[]> {
    const store = await this.store(context, request);
    return store.search(query, options);
  }

  async markUsed(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string): Promise<MemoryRecord> {
    const store = await this.store(context, request);
    return store.markUsed(id);
  }

  async govern(context: MemoryWorkspaceContext, request: MemoryScopeRequest, id: string, action: MemoryGovernanceAction, expectedRevision: number, expectedHash: string): Promise<MemoryRecord> {
    const store = await this.store(context, request);
    const current = ["active", "archived", "forgotten"].flatMap((status) => store.list({ status: status as MemoryRecord["status"], limit: 100 })).find((record) => record.id === id);
    if (!current) throw new MemoryStoreError("INVALID_RECORD", "Memory record is unavailable");
    assertMemoryRevision(current, expectedRevision, expectedHash);
    let next: MemoryRecord;
    try {
      next = transitionMemoryGovernance(current, action, "user");
    } catch (error) {
      if (error instanceof MemoryGovernanceError) throw error;
      throw new MemoryStoreError("INVALID_RECORD", "Memory governance transition failed");
    }
    return store.upsert({
      scope: current.scope,
      scopeKey: current.scopeKey,
      type: current.type,
      title: current.title,
      content: current.content,
      tags: current.tags,
      provenance: current.provenance,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
      lastUsedAt: current.lastUsedAt,
      useCount: current.useCount,
      status: next.status,
      governance: next.governance,
    });
  }

  async export(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<string> {
    const store = await this.store(context, request);
    const records = ["active", "archived", "forgotten"].flatMap((status) => store.list({ status: status as MemoryRecord["status"], limit: 100 }));
    return exportMemoryBundle(records);
  }

  async import(context: MemoryWorkspaceContext, request: MemoryScopeRequest, serialized: string): Promise<readonly MemoryRecord[]> {
    const store = await this.store(context, request);
    const imported = importMemoryBundle(serialized);
    const saved: MemoryRecord[] = [];
    for (const record of imported) {
      saved.push(await store.upsert({
        scope: store.scope,
        scopeKey: store.scopeKey,
        type: record.type,
        title: record.title,
        content: record.content,
        tags: record.tags,
        provenance: { kind: "import", note: "v0.5 import" },
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: Date.now(),
        status: record.status,
        governance: record.governance,
      }));
    }
    return saved;
  }

  async close(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<void> {
    const location = locationFor(context, request, this.dshHome);
    const store = this.stores.get(location.key);
    if (!store) return;
    this.stores.delete(location.key);
    await store.close();
  }

  async dispose(): Promise<void> {
    const stores = [...this.stores.values()];
    this.stores.clear();
    await Promise.all(stores.map((store) => store.close()));
  }

  private async store(context: MemoryWorkspaceContext, request: MemoryScopeRequest): Promise<MemoryStore> {
    const location = locationFor(context, request, this.dshHome);
    await this.open(context, request);
    return this.stores.get(location.key)!;
  }
}
