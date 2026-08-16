import type { Context } from "@deepseek-ai/cordis";
import { type ArtifactProjection, type SessionFileProjection } from "../domain/activity.ts";
import { WorkspaceMemoryDomain } from "../domain/memory.ts";
import { type SessionEventLike } from "./workspace-artifacts.ts";
/** Fixed title so the session surface groups auto facts as one stable digest family. */
export declare const AUTO_FACT_TITLE = "Session workspace digest (auto)";
/** Tags attached to every auto-captured fact record. */
export declare const AUTO_FACT_TAGS: readonly string[];
/** Agent handle as observed by the tool pipeline (subset of the session seam). */
export interface AutoWriteAgent {
    readonly id: string;
    readonly session?: {
        readonly header?: {
            readonly cwd?: string;
        };
        readonly events?: readonly SessionEventLike[];
    };
}
/**
 * Build a compact, human-readable fact digest from the durable session
 * projection. Deliberately deterministic for a given digest key so repeated
 * flushes of unchanged activity merge into the same record instead of piling
 * up. Only relative Workspace paths are included — never absolute host paths.
 */
export declare function buildAutoFactContent(touched: readonly SessionFileProjection[], artifacts: readonly ArtifactProjection[]): string;
/**
 * Derive one stable-id `session`-scope `fact` Memory record from the durable
 * tool records of a session. The record is governed as `derived` /
 * `unverified` (never injected into Agent/model context) and updated in place
 * for repeated identical digests. Returns the written record id, or undefined
 * when there is nothing useful to capture.
 */
export declare function writeAutoFact(memoryDomain: WorkspaceMemoryDomain, agent: AutoWriteAgent): Promise<string | undefined>;
/**
 * Host-side Memory auto-writer. Observes the existing `tools/result` seam,
 * debounces per session, derives a structured session digest, and upserts a
 * governed `unverified` `session`-scope `fact` record (stable id, updated in
 * place) so Memory exports carry useful information. No Agent/model context is
 * touched; the governance model is unchanged. Returns a disposer.
 */
export declare function attachWorkspaceMemoryAutoWriter(ctx: Context, memoryDomain?: WorkspaceMemoryDomain): () => void;
