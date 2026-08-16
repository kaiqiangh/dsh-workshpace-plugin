import type { Context } from "@deepseek-ai/cordis";
import { WorkspaceMemoryDomain } from "../domain/memory.ts";
import { type MemoryScope, type MemoryType } from "../domain/memory-store.ts";
export declare const MEMORY_PROPOSE_TOOL_NAME: "workspace_memory_propose";
export declare const MEMORY_PROPOSE_SECTION: "dsh-workspace-memory";
/** Agent handle as observed by the tool pipeline (session header carries the cwd). */
export interface MemoryProposeAgent {
    readonly id: string;
    readonly session?: {
        readonly header?: {
            readonly cwd?: string;
        };
    };
}
export interface MemoryProposeArgs {
    readonly scope?: "project" | "session";
    readonly type: MemoryType;
    readonly title: string;
    readonly content: string;
    readonly tags?: readonly string[];
}
/**
 * Persist one Agent proposal as a governed `model-suggested`, `unverified`
 * record with a session source reference. Proposals are never injected into
 * Agent/model context; only the user's explicit Verify makes them eligible.
 */
export declare function proposeMemory(memoryDomain: WorkspaceMemoryDomain, agent: MemoryProposeAgent, args: MemoryProposeArgs): Promise<{
    readonly id: string;
    readonly title: string;
    readonly scope: MemoryScope;
}>;
/** The Agent-facing tool definition; registered through the public tool registry. */
export declare function createMemoryProposeTool(memoryDomain: WorkspaceMemoryDomain): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Register the propose tool and its system-prompt guidance; returns a disposer. */
export declare function registerMemoryPropose(ctx: Context): () => void;
