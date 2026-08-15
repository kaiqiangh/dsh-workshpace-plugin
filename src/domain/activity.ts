import type {
  SessionBaseline,
  WorkspaceIdentity,
  WorkspacePath,
} from "./workspace.ts";
import { normalizeWorkspacePath } from "./workspace.ts";

export type ActivityKind = "READ" | "CREATED" | "MODIFIED" | "DELETED";
export type ActivitySource = "durable-tool" | "live-tool" | "git" | "filesystem";
export type ActivityAttribution = "agent-evidenced" | "session-observed" | "pre-existing" | "unknown";

export interface ActivityObservation {
  readonly id: string;
  readonly identity: WorkspaceIdentity;
  readonly path: WorkspacePath | string;
  readonly kind: ActivityKind;
  readonly observedAt: number;
  readonly source: ActivitySource;
  readonly attribution: ActivityAttribution;
  readonly previewable?: boolean;
}

export interface SessionFileProjection {
  readonly path: WorkspacePath;
  readonly firstObservedAt: number;
  readonly lastObservedAt: number;
  readonly observations: number;
  readonly current: "present" | "deleted" | "unknown";
  readonly lastKind: ActivityKind;
  readonly attribution: ActivityAttribution;
  readonly createdInSession: boolean;
  readonly previewable: boolean;
}

export interface ActivityProjection {
  readonly identity: WorkspaceIdentity;
  readonly evidence: readonly ActivityObservation[];
  readonly files: ReadonlyMap<WorkspacePath, SessionFileProjection>;
}

export interface WorkspaceChangeProjection {
  readonly path: WorkspacePath;
  readonly status: string;
  readonly attribution: ActivityAttribution;
}

export interface ArtifactProjection {
  readonly path: WorkspacePath;
  readonly createdAt: number;
}

export interface WorkingSetEntry {
  readonly path: WorkspacePath;
  readonly unresolved: boolean;
}

export interface WorkingSetState {
  readonly identity: WorkspaceIdentity;
  readonly max: number;
  readonly entries: readonly WorkingSetEntry[];
}

export class ActivityProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActivityProjectionError";
  }
}

function sameIdentity(left: WorkspaceIdentity, right: WorkspaceIdentity): boolean {
  return left.sessionId === right.sessionId && left.rootId === right.rootId;
}

function assertIdentity(expected: WorkspaceIdentity, actual: WorkspaceIdentity): void {
  if (!sameIdentity(expected, actual)) throw new ActivityProjectionError("Workspace identity does not match");
}

function initialProjection(identity: WorkspaceIdentity): ActivityProjection {
  return { identity, evidence: [], files: new Map() };
}

export function recordActivity(
  projection: ActivityProjection | undefined,
  observation: ActivityObservation,
): ActivityProjection {
  const current = projection ?? initialProjection(observation.identity);
  assertIdentity(current.identity, observation.identity);
  if (typeof observation.id !== "string" || !observation.id.trim()) {
    throw new ActivityProjectionError("Activity evidence requires an id");
  }
  const path = normalizeWorkspacePath(observation.path);
  const evidence: ActivityObservation = { ...observation, path };
  if (current.evidence.some((item) => item.id === evidence.id)) return current;
  const previous = current.files.get(path);
  const latest = previous === undefined || evidence.observedAt >= previous.lastObservedAt;
  const next: SessionFileProjection = {
    path,
    firstObservedAt: previous ? Math.min(previous.firstObservedAt, evidence.observedAt) : evidence.observedAt,
    lastObservedAt: previous ? Math.max(previous.lastObservedAt, evidence.observedAt) : evidence.observedAt,
    observations: (previous?.observations ?? 0) + 1,
    current: latest ? (evidence.kind === "DELETED" ? "deleted" : "present") : previous.current,
    lastKind: latest ? evidence.kind : previous.lastKind,
    attribution: latest ? evidence.attribution : previous.attribution,
    createdInSession: (previous?.createdInSession ?? false) || evidence.kind === "CREATED",
    previewable: (previous?.previewable ?? false) || evidence.previewable === true,
  };
  const files = new Map(current.files);
  files.set(path, next);
  return { identity: current.identity, evidence: [...current.evidence, evidence], files };
}

export function reduceActivity(
  identity: WorkspaceIdentity,
  observations: readonly ActivityObservation[],
): ActivityProjection {
  return observations.reduce((current, item) => recordActivity(current, item), initialProjection(identity));
}

export function deriveArtifacts(projection: ActivityProjection): readonly ArtifactProjection[] {
  return [...projection.files.values()]
    .filter((file) => file.createdInSession && file.current === "present" && file.previewable)
    .map((file) => ({ path: file.path, createdAt: file.firstObservedAt }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function deriveWorkspaceChanges(
  identity: WorkspaceIdentity,
  baseline: SessionBaseline,
  current: readonly { readonly path: WorkspacePath | string; readonly status: string; readonly attribution?: ActivityAttribution }[],
): readonly WorkspaceChangeProjection[] {
  if (baseline.rootId !== identity.rootId || baseline.sessionId !== identity.sessionId) {
    throw new ActivityProjectionError("Baseline identity does not match");
  }
  const baselinePaths = new Set(baseline.gitStatus?.map((item) => String(item.path)) ?? []);
  return current.map((item) => {
    const path = normalizeWorkspacePath(item.path);
    return {
      path,
      status: item.status,
      attribution: item.attribution ?? (baselinePaths.has(path) ? "pre-existing" : baseline.source === "git" ? "session-observed" : "unknown"),
    };
  });
}

export function createWorkingSet(identity: WorkspaceIdentity, max = 20): WorkingSetState {
  if (!Number.isSafeInteger(max) || max < 1) throw new ActivityProjectionError("Working Set maximum must be positive");
  return { identity, max, entries: [] };
}

export function pinWorkingSet(state: WorkingSetState, pathInput: string): WorkingSetState {
  const path = normalizeWorkspacePath(pathInput);
  if (state.entries.some((entry) => entry.path === path)) return state;
  if (state.entries.length >= state.max) throw new ActivityProjectionError("Working Set maximum exceeded");
  return { ...state, entries: [...state.entries, { path, unresolved: false }] };
}

export function markWorkingSetResolution(
  state: WorkingSetState,
  projection: ActivityProjection,
): WorkingSetState {
  assertIdentity(state.identity, projection.identity);
  return {
    ...state,
    entries: state.entries.map((entry) => ({
      ...entry,
      unresolved: projection.files.get(entry.path)?.current === "deleted",
    })),
  };
}

export function unpinWorkingSet(state: WorkingSetState, pathInput: string): WorkingSetState {
  const path = normalizeWorkspacePath(pathInput);
  return { ...state, entries: state.entries.filter((entry) => entry.path !== path) };
}

export function clearWorkingSet(state: WorkingSetState): WorkingSetState {
  return { ...state, entries: [] };
}
