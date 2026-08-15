import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export type WorkspacePath = string & { readonly __workspacePath: unique symbol };

export interface WorkspaceIdentity {
  readonly sessionId: string;
  readonly rootId: string;
}

export interface BaselineObservation {
  readonly source: "git" | "filesystem" | "unknown";
  readonly gitHead?: string;
  readonly gitStatus?: readonly { readonly status: string; readonly path: string }[];
  readonly fingerprint?: string;
  readonly reason?: string;
}

export interface SessionBaseline {
  readonly sessionId: string;
  readonly rootId: string;
  readonly capturedAt: number;
  readonly source: BaselineObservation["source"];
  readonly gitHead?: string;
  readonly gitStatus?: readonly { readonly status: string; readonly path: WorkspacePath }[];
  readonly fingerprint?: string;
  readonly reason?: string;
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
  if (typeof processCwd !== "string" || !processCwd.trim()) {
    throw new WorkspaceIdentityError("Process working directory is required");
  }
  if (typeof configuredRoot !== "string") {
    throw new WorkspaceIdentityError("Configured Workspace Root must be a string");
  }

  const logicalRoot = configuredRoot.replaceAll("\\", "/");
  if (logicalRoot.startsWith("/") || /^[A-Za-z]:/.test(logicalRoot) || logicalRoot.split("/").includes("..")) {
    throw new WorkspaceIdentityError("Configured Workspace Root must stay below the process working directory");
  }

  let canonicalProcessRoot: string;
  try {
    if (!statSync(processCwd).isDirectory()) {
      throw new WorkspaceIdentityError("Process working directory must be a directory");
    }
    canonicalProcessRoot = realpathSync.native(processCwd);
  } catch (error) {
    if (error instanceof WorkspaceIdentityError) throw error;
    throw new WorkspaceIdentityError("Process working directory is unavailable");
  }

  const candidate = resolve(canonicalProcessRoot, logicalRoot || ".");
  try {
    if (!statSync(candidate).isDirectory()) {
      throw new WorkspaceIdentityError("Workspace Root must be a directory");
    }
    const canonicalCandidate = realpathSync.native(candidate);
    const relativeCandidate = relative(canonicalProcessRoot, canonicalCandidate);
    if (
      relativeCandidate === ".." ||
      relativeCandidate.startsWith(`..${sep}`) ||
      isAbsolute(relativeCandidate)
    ) {
      throw new WorkspaceIdentityError("Configured Workspace Root must stay below the process working directory");
    }
    return canonicalCandidate;
  } catch (error) {
    if (error instanceof WorkspaceIdentityError) throw error;
    throw new WorkspaceIdentityError("Workspace Root is unavailable");
  }
}

function rootId(canonicalRoot: string): string {
  return `root:${createHash("sha256").update(canonicalRoot).digest("hex")}`;
}

function baselineFor(
  identity: WorkspaceIdentity,
  observation: BaselineObservation | undefined,
  capturedAt: number,
): SessionBaseline {
  return {
    sessionId: identity.sessionId,
    rootId: identity.rootId,
    capturedAt,
    source: observation?.source ?? "unknown",
    gitHead: observation?.gitHead,
    gitStatus: observation?.gitStatus?.map((change) => ({
      status: change.status,
      path: normalizeWorkspacePath(change.path),
    })),
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
  if (typeof args.sessionId !== "string" || !args.sessionId.trim()) {
    throw new WorkspaceIdentityError("Harness Session id is required");
  }
  const identity = {
    sessionId: args.sessionId,
    rootId: rootId(resolveWorkspaceRoot(args.processCwd, args.configuredRoot)),
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
  if (args.snapshot.baseline.sessionId !== args.snapshot.identity.sessionId || args.snapshot.baseline.rootId !== args.snapshot.identity.rootId) {
    throw new WorkspaceIdentityError("Workspace snapshot baseline does not match its identity");
  }
  if (args.snapshot.identity.rootId !== rootId(root)) {
    throw new WorkspaceIdentityError("Workspace Root does not match the snapshot");
  }
  return args.snapshot;
}
