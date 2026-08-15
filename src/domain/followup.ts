import { normalizeWorkspacePath, type WorkspaceIdentity, type WorkspacePath } from "./workspace.ts";
import type { WorkingSetEntry, WorkingSetState } from "./activity.ts";

export type AgentStatus = "running" | "idle";

export interface FollowupAgent {
  readonly identity: WorkspaceIdentity;
  readonly status: AgentStatus;
  readonly disposed?: boolean;
  readonly followup: (message: string) => Promise<void> | void;
}

export type AgentResolver = () => FollowupAgent | undefined | Promise<FollowupAgent | undefined>;

export type FollowupDeliveryErrorCode =
  | "INVALID_WORKING_SET"
  | "WORKSPACE_MISMATCH"
  | "AGENT_UNAVAILABLE"
  | "STALE_AGENT"
  | "DELIVERY_FAILED";

export class FollowupDeliveryError extends Error {
  readonly code: FollowupDeliveryErrorCode;

  constructor(code: FollowupDeliveryErrorCode, message: string) {
    super(message);
    this.name = "FollowupDeliveryError";
    this.code = code;
  }
}

export interface FollowupDeliveryResult {
  readonly message: string;
  readonly agentStatus: AgentStatus;
}

function assertWorkingSetBoundary(
  state: WorkingSetState,
  identity: WorkspaceIdentity,
  maxFiles: number,
): void {
  if (!state || typeof state !== "object" || !state.identity || !Array.isArray(state.entries)) {
    throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set state is invalid");
  }
  if (!sameIdentity(state.identity, identity)) {
    throw new FollowupDeliveryError("WORKSPACE_MISMATCH", "Working Set does not match the active Workspace");
  }
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) {
    throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set maximum is invalid");
  }
}

function sameIdentity(left: WorkspaceIdentity, right: WorkspaceIdentity): boolean {
  return left.sessionId === right.sessionId && left.rootId === right.rootId;
}

function validateEntry(entry: WorkingSetEntry): WorkspacePath {
  if (!entry || typeof entry !== "object" || typeof entry.path !== "string" || typeof entry.unresolved !== "boolean") {
    throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set entry is invalid");
  }
  let path: WorkspacePath;
  try {
    path = normalizeWorkspacePath(entry.path);
  } catch {
    throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set path is invalid");
  }
  if (!path || path !== entry.path) throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set paths must be normalized");
  return path;
}

export function buildWorkingSetMessage(state: WorkingSetState, identity: WorkspaceIdentity, maxFiles = 20): string {
  assertWorkingSetBoundary(state, identity, maxFiles);
  if (!Number.isSafeInteger(state.max) || state.max < 1 || state.max > maxFiles || state.entries.length > state.max || state.entries.length > maxFiles) {
    throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set exceeds its configured maximum");
  }
  const paths = state.entries.map(validateEntry);
  if (new Set(paths).size !== paths.length) throw new FollowupDeliveryError("INVALID_WORKING_SET", "Working Set paths must be unique");
  const lines = state.entries.map((entry, index) => `- ${paths[index]}${entry.unresolved ? " (unresolved)" : ""}`);
  return [
    "Inspect these Workspace Paths as needed; do not assume or inject their contents:",
    ...lines,
  ].join("\n");
}

export async function deliverWorkingSet(
  state: WorkingSetState,
  identity: WorkspaceIdentity,
  resolveAgent: AgentResolver,
  maxFiles = 20,
): Promise<FollowupDeliveryResult> {
  const message = buildWorkingSetMessage(state, identity, maxFiles);
  let agent: FollowupAgent | undefined;
  try {
    agent = await resolveAgent();
  } catch {
    throw new FollowupDeliveryError("AGENT_UNAVAILABLE", "Harness Agent is unavailable");
  }
  if (!agent) throw new FollowupDeliveryError("AGENT_UNAVAILABLE", "Harness Agent is unavailable");
  if (typeof agent !== "object" || typeof agent.followup !== "function") {
    throw new FollowupDeliveryError("AGENT_UNAVAILABLE", "Harness Agent is invalid");
  }
  if (!sameIdentity(agent.identity, identity) || agent.disposed === true) {
    throw new FollowupDeliveryError("STALE_AGENT", "Harness Agent is stale");
  }
  if (agent.status !== "running" && agent.status !== "idle") {
    throw new FollowupDeliveryError("AGENT_UNAVAILABLE", "Harness Agent status is unsupported");
  }
  try {
    await agent.followup(message);
  } catch {
    throw new FollowupDeliveryError("DELIVERY_FAILED", "Working Set follow-up could not be queued");
  }
  return { message, agentStatus: agent.status };
}
