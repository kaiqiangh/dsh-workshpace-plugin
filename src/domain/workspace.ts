import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { normalizeWorkspacePath, WorkspacePathError, type WorkspacePath } from "./path.ts";

export type { WorkspacePath } from "./path.ts";
export { normalizeWorkspacePath, WorkspacePathError } from "./path.ts";

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

export type WorkspaceIdentityErrorCode =
  | "INVALID_SESSION"
  | "INVALID_ROOT"
  | "ROOT_OUTSIDE_PROCESS"
  | "SESSION_MISMATCH"
  | "ROOT_MISMATCH"
  | "BASELINE_MISMATCH";

export class WorkspaceIdentityError extends Error {
  readonly code: WorkspaceIdentityErrorCode;

  constructor(code: WorkspaceIdentityErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceIdentityError";
    this.code = code;
  }
}

export function resolveWorkspaceRoot(processCwd: string, configuredRoot = "."): string {
  if (typeof processCwd !== "string" || !processCwd.trim()) {
    throw new WorkspaceIdentityError("INVALID_ROOT", "Process working directory is required");
  }
  if (typeof configuredRoot !== "string") {
    throw new WorkspaceIdentityError("INVALID_ROOT", "Configured Workspace Root must be a string");
  }

  const logicalRoot = configuredRoot.replaceAll("\\", "/");
  if (logicalRoot.startsWith("/") || /^[A-Za-z]:/.test(logicalRoot) || logicalRoot.split("/").includes("..")) {
    throw new WorkspaceIdentityError("ROOT_OUTSIDE_PROCESS", "Configured Workspace Root must stay below the process working directory");
  }

  let canonicalProcessRoot: string;
  try {
    if (!statSync(processCwd).isDirectory()) {
      throw new WorkspaceIdentityError("INVALID_ROOT", "Process working directory must be a directory");
    }
    canonicalProcessRoot = realpathSync.native(processCwd);
  } catch (error) {
    if (error instanceof WorkspaceIdentityError) throw error;
    throw new WorkspaceIdentityError("INVALID_ROOT", "Process working directory is unavailable");
  }

  const candidate = resolve(canonicalProcessRoot, logicalRoot || ".");
  try {
    if (!statSync(candidate).isDirectory()) {
      throw new WorkspaceIdentityError("INVALID_ROOT", "Workspace Root must be a directory");
    }
    const canonicalCandidate = realpathSync.native(candidate);
    const relativeCandidate = relative(canonicalProcessRoot, canonicalCandidate);
    if (
      relativeCandidate === ".." ||
      relativeCandidate.startsWith(`..${sep}`) ||
      isAbsolute(relativeCandidate)
    ) {
      throw new WorkspaceIdentityError("ROOT_OUTSIDE_PROCESS", "Configured Workspace Root must stay below the process working directory");
    }
    return canonicalCandidate;
  } catch (error) {
    if (error instanceof WorkspaceIdentityError) throw error;
    throw new WorkspaceIdentityError("INVALID_ROOT", "Workspace Root is unavailable");
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
  existingSnapshot?: WorkspaceSnapshot;
}): WorkspaceSnapshot {
  if (typeof args.sessionId !== "string" || !args.sessionId.trim()) {
    throw new WorkspaceIdentityError("INVALID_SESSION", "Harness Session id is required");
  }
  if (args.existingSnapshot) {
    return resumeWorkspace({
      snapshot: args.existingSnapshot,
      sessionId: args.sessionId,
      processCwd: args.processCwd,
      configuredRoot: args.configuredRoot,
    });
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
}): WorkspaceSnapshot {
  const root = resolveWorkspaceRoot(args.processCwd, args.configuredRoot);
  if (args.snapshot.identity.sessionId !== args.sessionId) {
    throw new WorkspaceIdentityError("SESSION_MISMATCH", "Harness Session does not match the snapshot");
  }
  if (args.snapshot.baseline.sessionId !== args.snapshot.identity.sessionId || args.snapshot.baseline.rootId !== args.snapshot.identity.rootId) {
    throw new WorkspaceIdentityError("BASELINE_MISMATCH", "Workspace snapshot baseline does not match its identity");
  }
  if (args.snapshot.identity.rootId !== rootId(root)) {
    throw new WorkspaceIdentityError("ROOT_MISMATCH", "Workspace Root does not match the snapshot");
  }
  return args.snapshot;
}
