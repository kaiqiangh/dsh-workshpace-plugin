import type {
  ActivityAttribution,
  ActivityKind,
  ActivityObservation,
  ActivityProjection,
  ActivitySource,
} from "./activity.ts";
import { ActivityProjectionError, recordActivity, reduceActivity } from "./activity.ts";
import type { SessionBaseline, WorkspaceIdentity, WorkspacePath } from "./workspace.ts";
import { normalizeWorkspacePath } from "./workspace.ts";

export interface LiveToolOutcome {
  readonly identity: WorkspaceIdentity;
  readonly callId: string;
  readonly rootCallId?: string;
  readonly tool: string;
  readonly arguments?: unknown;
  readonly result?: unknown;
  readonly ok?: boolean;
  readonly background?: boolean;
  readonly settled?: boolean;
  readonly observedAt: number;
  readonly eventSeq?: number;
  readonly source?: Extract<ActivitySource, "live-tool" | "durable-tool">;
  readonly potentiallyMutating?: boolean;
}

export interface ReconciliationRequest {
  readonly id: string;
  readonly debounceKey: string;
  readonly identity: WorkspaceIdentity;
  readonly callId: string;
  readonly rootCallId?: string;
  readonly observedAt: number;
  readonly reason: "potentially-mutating" | "failed-call" | "background-settled";
}

export interface ObservationBatch {
  readonly observations: readonly ActivityObservation[];
  readonly reconciliation?: ReconciliationRequest;
}

export interface ReconciliationEntry {
  readonly path: WorkspacePath | string;
  readonly previousPath?: WorkspacePath | string;
  readonly status?: string;
  readonly kind?: ActivityKind;
  readonly exists?: boolean;
  readonly previewable?: boolean;
}

export interface ReconciliationSnapshot {
  readonly id: string;
  readonly source: Extract<ActivitySource, "git" | "filesystem">;
  readonly observedAt: number;
  readonly entries: readonly ReconciliationEntry[];
}

export interface NativeDurableToolRecord {
  readonly seq: number;
  readonly time?: number;
  readonly type: string;
  readonly data?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface ActivitySummary {
  readonly path: WorkspacePath;
  readonly occurrences: number;
  readonly firstObservedAt: number;
  readonly lastObservedAt: number;
  readonly current: "present" | "deleted" | "unknown";
  readonly attribution: ActivityAttribution;
}

const READ_TOOLS = /^(?:read|read[-_]file|read[-_]image|read[-_]binary|file[-_]read)$/i;
const WRITE_TOOLS = /^(?:write|write[-_]file|file[-_]write|create[-_]file)$/i;
const EDIT_TOOLS = /^(?:edit|edit[-_]file|file[-_]edit|apply[-_]patch|str[-_]replace)$/i;
const DELETE_TOOLS = /^(?:delete|delete[-_]file|remove[-_]file|file[-_]delete)$/i;
const EDITOR_TOOLS = /(?:editor|structured|document|patch)/i;
const SHELL_TOOLS = /(?:shell|bash|zsh|sh|powershell|terminal|exec|command|run|python|node|git)/i;
const NON_PREVIEWABLE_EXTENSIONS = /\.(?:7z|avi|bin|doc|docx|gz|mp3|mp4|odt|ppt|pptx|tar|wav|xls|xlsx|zip|svg)$/iu;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function resultValue(result: unknown): unknown {
  const record = asRecord(result);
  return record && "value" in record ? record.value : result;
}

function isSuccessful(outcome: LiveToolOutcome): boolean {
  if (outcome.ok === false) return false;
  const result = asRecord(outcome.result);
  return result?.ok !== false && result?.success !== false && result?.error === undefined;
}

function field(record: Record<string, unknown> | undefined, ...names: string[]): unknown {
  for (const name of names) if (record && name in record) return record[name];
  return undefined;
}

function pathInputs(outcome: LiveToolOutcome): string[] {
  const args = asRecord(outcome.arguments);
  const value = asRecord(resultValue(outcome.result));
  const paths: unknown[] = [];
  for (const record of [args, value]) {
    paths.push(field(record, "path", "file", "filePath", "file_path", "filename", "target"));
    for (const collection of [field(record, "paths", "files", "locations", "diffs")]) {
      if (Array.isArray(collection)) {
        for (const item of collection) {
          paths.push(typeof item === "string" ? item : field(asRecord(item), "path", "file", "filePath", "file_path", "filename", "target"));
        }
      }
    }
  }
  return [...new Set(paths.filter((path): path is string => typeof path === "string" && path.trim() !== ""))];
}

function editorAction(outcome: LiveToolOutcome): string | undefined {
  const args = asRecord(outcome.arguments);
  const value = asRecord(resultValue(outcome.result));
  const action = field(args, "operation", "action", "command", "mode", "op")
    ?? field(value, "operation", "action", "command", "mode", "op");
  return typeof action === "string" ? action.toLowerCase() : undefined;
}

function writeKind(outcome: LiveToolOutcome): ActivityKind {
  const value = asRecord(resultValue(outcome.result));
  const action = editorAction(outcome);
  const diffs = field(value, "diffs");
  if (Array.isArray(diffs) && diffs.length > 0) {
    return diffs.some((item) => asRecord(item)?.oldText === null) ? "CREATED" : "MODIFIED";
  }
  if (value?.created === true || value?.created === "true" || value?.existsBefore === false
    || value?.status === "created" || value?.action === "create" || action === "create") return "CREATED";
  return "MODIFIED";
}

function directKind(outcome: LiveToolOutcome): ActivityKind | undefined {
  const name = outcome.tool.trim();
  const value = asRecord(resultValue(outcome.result));
  if (Array.isArray(field(value, "diffs"))) return writeKind(outcome);
  if (READ_TOOLS.test(name)) return "READ";
  if (WRITE_TOOLS.test(name)) return writeKind(outcome);
  if (DELETE_TOOLS.test(name)) return "DELETED";
  if (EDIT_TOOLS.test(name)) return "MODIFIED";
  if (!EDITOR_TOOLS.test(name)) return undefined;
  switch (editorAction(outcome)) {
    case "view":
    case "read": return "READ";
    case "create": return "CREATED";
    case "delete":
    case "remove": return "DELETED";
    case "replace":
    case "insert":
    case "edit":
    case "update": return "MODIFIED";
    default: return undefined;
  }
}

function potentiallyMutating(outcome: LiveToolOutcome, kind: ActivityKind | undefined): boolean {
  if (outcome.potentiallyMutating === true) return true;
  if (kind !== undefined) return !READ_TOOLS.test(outcome.tool);
  return SHELL_TOOLS.test(outcome.tool);
}

function observationId(outcome: LiveToolOutcome, path: string, index: number): string {
  if (outcome.eventSeq !== undefined) return `durable:${outcome.identity.sessionId}:${outcome.eventSeq}:${index}:${path}`;
  const call = outcome.callId || outcome.rootCallId || "unknown-call";
  return `${outcome.source ?? "live-tool"}:${call}:${index}:${path}`;
}

function previewablePath(path: string): boolean {
  return !NON_PREVIEWABLE_EXTENSIONS.test(path);
}

export function classifyToolOutcome(outcome: LiveToolOutcome): readonly ActivityObservation[] {
  if (!isSuccessful(outcome) || (outcome.background === true && outcome.settled !== true)) return [];
  const kind = directKind(outcome);
  if (kind === undefined) return [];
  const source = outcome.source ?? "live-tool";
  return pathInputs(outcome).map((path, index) => ({
    id: observationId(outcome, path, index),
    identity: outcome.identity,
    path: normalizeWorkspacePath(path),
    kind,
    observedAt: outcome.observedAt,
    source,
    attribution: "agent-evidenced" as const,
    previewable: previewablePath(path),
  }));
}

export function reconciliationFor(outcome: LiveToolOutcome): ReconciliationRequest | undefined {
  const kind = directKind(outcome);
  if (!potentiallyMutating(outcome, kind)) return undefined;
  if (outcome.background === true && outcome.settled !== true) return undefined;
  if (isSuccessful(outcome) && kind !== undefined && !SHELL_TOOLS.test(outcome.tool)) return undefined;
  const callId = outcome.callId || outcome.rootCallId || "unknown-call";
  const reason = outcome.background === true && outcome.settled === true
    ? "background-settled"
    : isSuccessful(outcome) ? "potentially-mutating" : "failed-call";
  const debounceKey = `${outcome.identity.sessionId}:${outcome.identity.rootId}`;
  return {
    id: `reconcile:${callId}:${outcome.observedAt}`,
    debounceKey,
    identity: outcome.identity,
    callId,
    rootCallId: outcome.rootCallId,
    observedAt: outcome.observedAt,
    reason,
  };
}

export function observeLiveTool(outcome: LiveToolOutcome): ObservationBatch {
  const observations = classifyToolOutcome(outcome);
  return { observations, reconciliation: reconciliationFor(outcome) };
}

function statusKind(entry: ReconciliationEntry): ActivityKind {
  if (entry.kind !== undefined) return entry.kind;
  if (entry.exists === false || /(?:^|\s)D(?:\s|$)|deleted|missing/i.test(entry.status ?? "")) return "DELETED";
  if (/^\?\?|(?:^|\s)A(?:\s|$)|added|created|untracked/i.test(entry.status ?? "")) return "CREATED";
  return "MODIFIED";
}

function baselinePathSet(baseline: SessionBaseline): Set<string> {
  return new Set((baseline.gitStatus ?? []).map((item) => normalizeWorkspacePath(item.path)));
}

function reconciliationAttribution(
  source: ReconciliationSnapshot["source"],
  path: WorkspacePath,
  baselinePaths: Set<string>,
): ActivityAttribution {
  if (baselinePaths.has(path)) return "pre-existing";
  return source === "git" ? "session-observed" : "unknown";
}

export function reconcileSnapshot(
  identity: WorkspaceIdentity,
  baseline: SessionBaseline,
  snapshot: ReconciliationSnapshot,
): readonly ActivityObservation[] {
  if (baseline.sessionId !== identity.sessionId || baseline.rootId !== identity.rootId) {
    throw new ActivityProjectionError("Baseline identity does not match Workspace identity");
  }
  const baselinePaths = baselinePathSet(baseline);
  const observations: ActivityObservation[] = [];
  for (const [index, entry] of snapshot.entries.entries()) {
    const kind = statusKind(entry);
    const path = normalizeWorkspacePath(entry.path);
    const attribution = reconciliationAttribution(snapshot.source, path, baselinePaths);
    const base = `reconcile:${snapshot.id}:${index}`;
    if (entry.previousPath !== undefined) {
      const previousPath = normalizeWorkspacePath(entry.previousPath);
      const previousAttribution = reconciliationAttribution(snapshot.source, previousPath, baselinePaths);
      observations.push({
        id: `${base}:delete:${previousPath}`,
        identity, path: previousPath, kind: "DELETED", observedAt: snapshot.observedAt,
        source: snapshot.source, attribution: previousAttribution,
      });
      observations.push({
        id: `${base}:create:${path}`,
        identity, path, kind: "CREATED", observedAt: snapshot.observedAt,
        source: snapshot.source, attribution, previewable: entry.previewable,
      });
      continue;
    }
    observations.push({
      id: `${base}:${kind}:${path}`,
      identity, path, kind, observedAt: snapshot.observedAt,
      source: snapshot.source, attribution, previewable: entry.previewable,
    });
  }
  return observations;
}

export function summarizeActivity(projection: ActivityProjection): readonly ActivitySummary[] {
  return [...projection.files.values()].map((file) => ({
    path: file.path,
    occurrences: file.observations,
    firstObservedAt: file.firstObservedAt,
    lastObservedAt: file.lastObservedAt,
    current: file.current,
    attribution: file.attribution,
  })).sort((left, right) => left.path.localeCompare(right.path));
}

export class DebouncedReconciliationQueue {
  private readonly pendingByKey = new Map<string, ReconciliationRequest>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly delayMs: number;
  private readonly onFlush: (requests: readonly ReconciliationRequest[]) => void;

  constructor(
    delayMs = 150,
    onFlush: (requests: readonly ReconciliationRequest[]) => void = () => {},
  ) {
    this.delayMs = delayMs;
    this.onFlush = onFlush;
  }

  request(request: ReconciliationRequest): void {
    this.pendingByKey.set(request.debounceKey, request);
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush(); }, this.delayMs);
  }

  pending(): readonly ReconciliationRequest[] {
    return [...this.pendingByKey.values()];
  }

  flush(): readonly ReconciliationRequest[] {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const requests = this.pending();
    this.pendingByKey.clear();
    if (requests.length > 0) this.onFlush(requests);
    return requests;
  }

  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.pendingByKey.clear();
  }
}

function durableOutcome(identity: WorkspaceIdentity, record: NativeDurableToolRecord): LiveToolOutcome | undefined {
  const data = record.data ?? record;
  const type = String(record.type ?? data.type ?? "");
  const hasResult = "result" in data || "value" in data || /tool[/:_-]?result|code[/:_-]?dispatch/i.test(type);
  if (!hasResult) return undefined;
  const tool = field(data, "tool", "name", "toolName");
  if (typeof tool !== "string") return undefined;
  const callId = field(data, "callId", "call_id", "id");
  const rootCallId = field(data, "rootCallId", "root_call_id");
  const result = "result" in data ? data.result : data.value;
  return {
    identity,
    callId: typeof callId === "string" ? callId : `durable-${record.seq}`,
    rootCallId: typeof rootCallId === "string" ? rootCallId : undefined,
    tool,
    arguments: field(data, "arguments", "args", "input"),
    result,
    ok: typeof data.ok === "boolean" ? data.ok : typeof data.success === "boolean" ? data.success : undefined,
    observedAt: typeof record.time === "number" ? record.time : record.seq,
    eventSeq: record.seq,
    source: "durable-tool",
    potentiallyMutating: data.potentiallyMutating === true,
  };
}

export class SessionActivityObserver {
  private projectionState: ActivityProjection;
  private replayed = false;
  private readonly liveKeys = new Set<string>();
  private readonly durableCallKeys = new Set<string>();
  readonly identity: WorkspaceIdentity;
  readonly baseline: SessionBaseline;
  readonly reconciliations: DebouncedReconciliationQueue;

  constructor(
    identity: WorkspaceIdentity,
    baseline: SessionBaseline,
    reconciliationQueue = new DebouncedReconciliationQueue(),
  ) {
    this.identity = identity;
    this.baseline = baseline;
    this.projectionState = reduceActivity(identity, []);
    this.reconciliations = reconciliationQueue;
  }

  get projection(): ActivityProjection {
    return this.projectionState;
  }

  resume(records: readonly NativeDurableToolRecord[]): ActivityProjection {
    if (this.replayed) return this.projectionState;
    this.replayed = true;
    for (const record of [...records].sort((left, right) => left.seq - right.seq)) {
      const outcome = durableOutcome(this.identity, record);
      if (outcome !== undefined) {
        if (outcome.background !== true || outcome.settled === true) this.durableCallKeys.add(outcome.callId || outcome.rootCallId || "");
        this.applyBatch(observeLiveTool(outcome));
      }
    }
    return this.projectionState;
  }

  consumeLive(outcome: LiveToolOutcome): ObservationBatch {
    if (outcome.identity.sessionId !== this.identity.sessionId || outcome.identity.rootId !== this.identity.rootId) {
      throw new ActivityProjectionError("Workspace identity does not match observer");
    }
    const callIdentity = (typeof outcome.callId === "string" ? outcome.callId.trim() : "")
      || (typeof outcome.rootCallId === "string" ? outcome.rootCallId.trim() : "");
    if (!callIdentity) throw new ActivityProjectionError("Live outcome requires a call identity");
    if ((outcome.background !== true || outcome.settled === true) && this.durableCallKeys.has(callIdentity)) {
      return { observations: [] };
    }
    const key = `${callIdentity}:${outcome.background === true ? (outcome.settled === true ? "settled" : "started") : "result"}`;
    if (this.liveKeys.has(key)) return { observations: [] };
    const batch = observeLiveTool(outcome);
    if (batch.observations.length > 0 || batch.reconciliation !== undefined) {
      this.liveKeys.add(key);
      this.applyBatch(batch);
    }
    return batch;
  }

  applyReconciliation(snapshot: ReconciliationSnapshot): ActivityProjection {
    for (const observation of reconcileSnapshot(this.identity, this.baseline, snapshot)) {
      this.projectionState = recordActivity(this.projectionState, observation);
    }
    return this.projectionState;
  }

  dispose(): void {
    this.reconciliations.dispose();
  }

  private applyBatch(batch: ObservationBatch): void {
    for (const observation of batch.observations) {
      this.projectionState = recordActivity(this.projectionState, observation);
    }
    if (batch.reconciliation !== undefined) this.reconciliations.request(batch.reconciliation);
  }
}
