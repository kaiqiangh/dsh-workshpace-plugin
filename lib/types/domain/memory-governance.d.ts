import { type MemoryGovernance, type MemoryContentHash, type MemoryRecord, type MemoryRetention, type MemorySourceRef } from "./memory-store.ts";
export declare const MEMORY_MAX_IMPORT_RECORDS = 10000;
export type MemoryGovernanceAction = "verify" | "reject" | "reverify" | "pin" | "unpin" | "archive" | "restore" | "stale" | "forget";
export type MemoryGovernanceErrorCode = "INVALID_TRANSITION" | "UNAUTHORIZED" | "CONFLICT" | "INELIGIBLE" | "INVALID_SOURCE";
export declare class MemoryGovernanceError extends Error {
    readonly code: MemoryGovernanceErrorCode;
    constructor(code: MemoryGovernanceErrorCode, message: string);
}
export interface MemoryRevisionConflict {
    readonly code: "CONFLICT";
    readonly id: string;
    readonly currentRevision: number;
    readonly currentHash: string;
    readonly expectedRevision: number;
    readonly expectedHash: string;
}
export declare const memoryRetentionForScope: (scope: MemoryRecord["scope"]) => MemoryRetention;
export declare function memoryGovernance(record: MemoryRecord): MemoryGovernance;
export declare function memoryGovernanceEligible(record: MemoryRecord, now?: number): boolean;
export declare function assertMemoryRevision(record: MemoryRecord, expectedRevision: number, expectedHash: string): void;
export declare function transitionMemoryGovernance(record: MemoryRecord, action: MemoryGovernanceAction, actor?: "user" | "trusted-tool", now?: number): MemoryRecord;
export declare function conflictGroupFor(title: string): string;
export declare function sourceRef(kind: MemorySourceRef["kind"], id: string, contentHash?: MemoryContentHash): MemorySourceRef;
export interface MemoryExportBundle {
    readonly schemaVersion: 1;
    readonly exportedAt: number;
    readonly records: readonly MemoryRecord[];
}
export declare function exportMemoryBundle(records: readonly MemoryRecord[], now?: number): string;
export declare function importMemoryBundle(serialized: string, now?: number): readonly MemoryRecord[];
