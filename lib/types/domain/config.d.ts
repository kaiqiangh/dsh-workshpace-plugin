import { type BaselineObservation, type WorkspaceSnapshot } from "./workspace.ts";
export interface WorkspaceConfig {
    readonly enabled: boolean;
    readonly root: string;
    readonly files: {
        readonly showHidden: boolean;
        readonly exclude: readonly string[];
    };
    readonly preview: {
        readonly maxTextBytes: number;
        readonly maxJsonBytes: number;
        readonly maxCsvBytes: number;
        readonly maxCsvRows: number;
        readonly maxImageBytes: number;
        readonly maxPdfBytes: number;
    };
    readonly git: {
        readonly enabled: boolean;
    };
    readonly activity: {
        readonly trackReads: boolean;
        readonly trackWrites: boolean;
        readonly trackShellChanges: boolean;
        readonly maxTimelineEvents: number;
        readonly coalesceWindowMs: number;
    };
    readonly workingSet: {
        readonly maxFiles: number;
    };
}
export interface WorkspaceConfigInput {
    readonly enabled?: unknown;
    readonly root?: unknown;
    readonly files?: {
        readonly showHidden?: unknown;
        readonly exclude?: unknown;
    };
    readonly preview?: Partial<Record<keyof WorkspaceConfig["preview"], unknown>>;
    readonly git?: {
        readonly enabled?: unknown;
    };
    readonly activity?: Partial<Record<keyof WorkspaceConfig["activity"], unknown>>;
    readonly workingSet?: {
        readonly maxFiles?: unknown;
    };
}
export interface ConfigResolution {
    readonly config: WorkspaceConfig;
    readonly warnings: readonly string[];
}
export type CapabilityStatus = "ready" | "unsupported";
export interface WorkspaceCapabilities {
    readonly core: CapabilityStatus;
    readonly git: CapabilityStatus;
    readonly preview: CapabilityStatus;
}
export declare function resolveWorkspaceConfig(file?: WorkspaceConfigInput, hostOverride?: WorkspaceConfigInput): ConfigResolution;
export declare function parseWorkspaceConfigText(text: string): WorkspaceConfigInput;
export declare function readWorkspaceConfigFile(processCwd: string): Promise<WorkspaceConfigInput | undefined>;
export declare function startConfiguredWorkspace(args: {
    readonly sessionId: string;
    readonly processCwd: string;
    readonly fileConfig?: WorkspaceConfigInput;
    readonly hostOverride?: WorkspaceConfigInput;
    readonly baseline?: BaselineObservation;
    /** Host probes are optional; unknown optional services stay conservatively unsupported. */
    readonly gitAvailable?: boolean;
    readonly previewAvailable?: boolean;
}): Promise<{
    readonly workspace: WorkspaceSnapshot;
    readonly config: WorkspaceConfig;
    readonly warnings: readonly string[];
    readonly capabilities: WorkspaceCapabilities;
}>;
export declare function reportWorkspaceCapabilities(gitAvailable: boolean, previewAvailable: boolean, coreAvailable?: boolean): WorkspaceCapabilities;
