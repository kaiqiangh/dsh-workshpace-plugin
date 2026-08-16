import type { Context } from "@deepseek-ai/cordis";
import { WorkspaceMemoryDomain, type MemoryHostAgent } from "../domain/memory.ts";
import { type MemoryScope, type MemoryType } from "../domain/memory-store.ts";
export declare const MEMORY_PROPOSE_TOOL_NAME: "workspace_memory_propose";
export declare const MEMORY_PROPOSE_SECTION: "dsh-workspace-memory";
export interface MemoryProposeArgs {
    readonly scope?: "project" | "session";
    readonly type: MemoryType;
    readonly title: string;
    readonly content: string;
    readonly tags?: readonly string[];
}
/**
 * Persist one Agent proposal as a governed `model-suggested`, `unverified`
 * record with session and tool-call source references. Proposals are never
 * injected into Agent/model context; only the user's explicit Verify makes
 * them eligible.
 */
export declare function proposeMemory(memoryDomain: WorkspaceMemoryDomain, agent: MemoryHostAgent, args: MemoryProposeArgs, eventId?: string): Promise<{
    readonly id: string;
    readonly title: string;
    readonly scope: MemoryScope;
}>;
/** The Agent-facing tool definition; registered through the public tool registry. */
export declare function createMemoryProposeTool(memoryDomain: WorkspaceMemoryDomain): import("@deepseek-ai/dsh-tools").ToolDefinition;
/**
 * Register the propose tool and its system-prompt guidance against the
 * shared Memory domain (the same instance the Host RPC service uses, so
 * proposals are visible to the Web surface immediately). Returns a disposer.
 */
export declare function registerMemoryPropose(ctx: Context, memoryDomain: WorkspaceMemoryDomain): () => void;
