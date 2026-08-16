import { type WorkspaceIdentity } from "./workspace.ts";
import type { WorkingSetState } from "./activity.ts";
export type AgentStatus = "running" | "idle";
export interface FollowupAgent {
    readonly identity: WorkspaceIdentity;
    readonly status: AgentStatus;
    readonly disposed?: boolean;
    readonly followup: (message: string) => Promise<void> | void;
}
export type AgentResolver = () => FollowupAgent | undefined | Promise<FollowupAgent | undefined>;
export type FollowupDeliveryErrorCode = "INVALID_WORKING_SET" | "WORKSPACE_MISMATCH" | "AGENT_UNAVAILABLE" | "STALE_AGENT" | "DELIVERY_FAILED";
export declare class FollowupDeliveryError extends Error {
    readonly code: FollowupDeliveryErrorCode;
    constructor(code: FollowupDeliveryErrorCode, message: string);
}
export interface FollowupDeliveryResult {
    readonly message: string;
    readonly agentStatus: AgentStatus;
}
export declare function buildWorkingSetMessage(state: WorkingSetState, identity: WorkspaceIdentity, maxFiles?: number): string;
export declare function deliverWorkingSet(state: WorkingSetState, identity: WorkspaceIdentity, resolveAgent: AgentResolver, maxFiles?: number): Promise<FollowupDeliveryResult>;
