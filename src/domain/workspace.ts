import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";

export type WorkspacePath = string & { readonly __workspacePath: unique symbol };

export interface WorkspaceIdentity {
  readonly sessionId: string;
  readonly root: string;
}

export interface BaselineObservation {
  readonly source: "git" | "filesystem" | "unknown";
  readonly gitHead?: string;
  readonly gitStatus?: readonly string[];
  readonly fingerprint?: string;
  readonly reason?: string;
}

export interface SessionBaseline extends BaselineObservation {
  readonly sessionId: string;
  readonly root: string;
  readonly capturedAt: number;
}

export interface WorkspaceSnapshot {
  readonly identity: WorkspaceIdentity;
  readonly baseline: SessionBaseline;
}

export type WorkspaceLifecycle = WorkspaceSnapshot;

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export class WorkspaceIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceIdentityError";
  }
}

export function normalizeWorkspacePath(input: string): WorkspacePath {
  if (typeof input !== "string" || input.includes("\0")) {
    throw new WorkspacePathError("Workspace Path must be a valid string");
  }

  const logicalPath = input.replaceAll("\\", "/");
  if (logicalPath.startsWith("/") || /^[A-Za-z]:/.test(logicalPath)) {
    throw new WorkspacePathError("Workspace Path must be relative");
  }

  const segments = logicalPath.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new WorkspacePathError("Workspace Path cannot traverse its root");
  }

  return segments.filter((segment) => segment && segment !== ".").join("/") as WorkspacePath;
}

export function resolveWorkspaceRoot(processCwd: string, configuredRoot = "."): string {
  const candidate = resolve(processCwd, configuredRoot);
  try {
    if (!statSync(candidate).isDirectory()) {
      throw new WorkspaceIdentityError("Workspace Root must be a directory");
    }
    return realpathSync.native(candidate);
  } catch (error) {
    if (error instanceof WorkspaceIdentityError) throw error;
    throw new WorkspaceIdentityError(`Workspace Root is unavailable: ${candidate}`);
  }
}

function baselineFor(
  identity: WorkspaceIdentity,
  observation: BaselineObservation | undefined,
  capturedAt: number,
): SessionBaseline {
  return {
    sessionId: identity.sessionId,
    root: identity.root,
    capturedAt,
    source: observation?.source ?? "unknown",
    gitHead: observation?.gitHead,
    gitStatus: observation?.gitStatus,
    fingerprint: observation?.fingerprint,
    reason: observation?.reason ?? (observation ? undefined : "baseline observation unavailable"),
  };
}

export function startWorkspace(args: {
  sessionId: string;
  processCwd: string;
  configuredRoot?: string;
  baseline?: BaselineObservation;
  capturedAt?: number;
}): WorkspaceLifecycle {
  const identity = {
    sessionId: args.sessionId,
    root: resolveWorkspaceRoot(args.processCwd, args.configuredRoot),
  };
  return {
    identity,
    baseline: baselineFor(identity, args.baseline, args.capturedAt ?? Date.now()),
  };
}

export function resumeWorkspace(args: {
  snapshot: WorkspaceSnapshot;
  sessionId: string;
  processCwd: string;
  configuredRoot?: string;
}): WorkspaceLifecycle {
  const root = resolveWorkspaceRoot(args.processCwd, args.configuredRoot);
  if (args.snapshot.identity.sessionId !== args.sessionId) {
    throw new WorkspaceIdentityError("Workspace Session does not match the snapshot");
  }
  if (args.snapshot.identity.root !== root) {
    throw new WorkspaceIdentityError("Workspace Root does not match the snapshot");
  }
  return args.snapshot;
}
