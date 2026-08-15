import { type WorkspacePath } from "./path.ts";
export type { WorkspacePath } from "./path.ts";
export { normalizeWorkspacePath, WorkspacePathError } from "./path.ts";
export interface WorkspaceIdentity {
    readonly sessionId: string;
    readonly rootId: string;
}
export interface BaselineObservation {
    readonly source: "git" | "filesystem" | "unknown";
    readonly gitHead?: string;
    readonly gitStatus?: readonly {
        readonly status: string;
        readonly path: string;
    }[];
    readonly fingerprint?: string;
    readonly reason?: string;
}
export interface SessionBaseline {
    readonly sessionId: string;
    readonly rootId: string;
    readonly capturedAt: number;
    readonly source: BaselineObservation["source"];
    readonly gitHead?: string;
    readonly gitStatus?: readonly {
        readonly status: string;
        readonly path: WorkspacePath;
    }[];
    readonly fingerprint?: string;
    readonly reason?: string;
}
export interface WorkspaceSnapshot {
    readonly identity: WorkspaceIdentity;
    readonly baseline: SessionBaseline;
}
export type WorkspaceIdentityErrorCode = "INVALID_SESSION" | "INVALID_ROOT" | "ROOT_OUTSIDE_PROCESS" | "SESSION_MISMATCH" | "ROOT_MISMATCH" | "BASELINE_MISMATCH";
export declare class WorkspaceIdentityError extends Error {
    readonly code: WorkspaceIdentityErrorCode;
    constructor(code: WorkspaceIdentityErrorCode, message: string);
}
export declare function resolveWorkspaceRoot(processCwd: string, configuredRoot?: string): string;
export declare function startWorkspace(args: {
    sessionId: string;
    processCwd: string;
    configuredRoot?: string;
    baseline?: BaselineObservation;
    capturedAt?: number;
    existingSnapshot?: WorkspaceSnapshot;
}): WorkspaceSnapshot;
export declare function resumeWorkspace(args: {
    snapshot: WorkspaceSnapshot;
    sessionId: string;
    processCwd: string;
    configuredRoot?: string;
}): WorkspaceSnapshot;
