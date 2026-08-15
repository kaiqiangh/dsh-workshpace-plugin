import type { SessionBaseline, WorkspaceIdentity, WorkspacePath } from "./workspace.ts";
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
    readonly previousPath?: WorkspacePath;
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
export declare class ActivityProjectionError extends Error {
    constructor(message: string);
}
export declare function recordActivity(projection: ActivityProjection | undefined, observation: ActivityObservation): ActivityProjection;
export declare function reduceActivity(identity: WorkspaceIdentity, observations: readonly ActivityObservation[]): ActivityProjection;
export declare function resumeActivityProjection(projection: ActivityProjection, identity: WorkspaceIdentity, observations?: readonly ActivityObservation[]): ActivityProjection;
export declare function deriveArtifacts(projection: ActivityProjection): readonly ArtifactProjection[];
export declare function deriveWorkspaceChanges(identity: WorkspaceIdentity, baseline: SessionBaseline, current: readonly {
    readonly path: WorkspacePath | string;
    readonly previousPath?: WorkspacePath | string;
    readonly status: string;
    readonly attribution?: ActivityAttribution;
}[]): readonly WorkspaceChangeProjection[];
export declare function createWorkingSet(identity: WorkspaceIdentity, max?: number): WorkingSetState;
export declare function pinWorkingSet(state: WorkingSetState, pathInput: string): WorkingSetState;
export declare function markWorkingSetResolution(state: WorkingSetState, projection: ActivityProjection, changes?: readonly WorkspaceChangeProjection[]): WorkingSetState;
export declare function unpinWorkingSet(state: WorkingSetState, pathInput: string): WorkingSetState;
export declare function clearWorkingSet(state: WorkingSetState): WorkingSetState;
