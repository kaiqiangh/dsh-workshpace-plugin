import { defineTool } from "@deepseek-ai/dsh-tools";
import type { Context } from "@deepseek-ai/cordis";

import { WorkspaceMemoryDomain, workspaceMemoryContextFor, type MemoryHostAgent } from "../domain/memory.ts";
import { memoryRetentionForScope } from "../domain/memory-governance.ts";
import { MemoryStoreError, type MemoryScope, type MemorySourceRef, type MemoryType } from "../domain/memory-store.ts";
import { MEMORY_TYPES } from "../types.ts";

export const MEMORY_PROPOSE_TOOL_NAME = "workspace_memory_propose" as const;
export const MEMORY_PROPOSE_SECTION = "dsh-workspace-memory" as const;

export interface MemoryProposeArgs {
  readonly scope?: "project" | "session";
  readonly type: MemoryType;
  readonly title: string;
  readonly content: string;
  readonly tags?: readonly string[];
}

function assertProposalArgs(args: MemoryProposeArgs): void {
  if (!args || typeof args !== "object") throw new MemoryStoreError("INVALID_RECORD", "Memory proposal arguments are invalid");
  if (args.scope !== undefined && args.scope !== "project" && args.scope !== "session") throw new MemoryStoreError("INVALID_RECORD", "Memory proposal scope is invalid");
  if (!MEMORY_TYPES.includes(args.type)) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal type is invalid");
  if (typeof args.title !== "string" || !args.title.trim()) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal title is required");
  if (typeof args.content !== "string" || !args.content.trim()) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal content is required");
  if (args.tags !== undefined && !Array.isArray(args.tags)) throw new MemoryStoreError("INVALID_RECORD", "Memory proposal tags are invalid");
}

/**
 * Persist one Agent proposal as a governed `model-suggested`, `unverified`
 * record with session and tool-call source references. Proposals are never
 * injected into Agent/model context; only the user's explicit Verify makes
 * them eligible.
 */
export async function proposeMemory(
  memoryDomain: WorkspaceMemoryDomain,
  agent: MemoryHostAgent,
  args: MemoryProposeArgs,
  eventId?: string,
): Promise<{ readonly id: string; readonly title: string; readonly scope: MemoryScope }> {
  assertProposalArgs(args);
  const { identity, root } = workspaceMemoryContextFor(agent);
  const scope: MemoryScope = args.scope === "session" ? "session" : "project";
  const request = { scope };
  const context = { identity, root };
  const state = await memoryDomain.open(context, request);
  const sourceRefs: MemorySourceRef[] = [{ kind: "session", id: agent.id }];
  if (typeof eventId === "string" && eventId.trim()) sourceRefs.push({ kind: "event", id: eventId.trim() });
  const record = await memoryDomain.upsert(context, request, {
    scope: state.scope,
    scopeKey: state.scopeKey,
    type: args.type,
    title: args.title,
    content: args.content,
    tags: args.tags ?? [],
    provenance: { kind: "agent", sessionId: agent.id, note: "memory proposal" },
    governance: {
      origin: "model-suggested",
      sourceRefs,
      verification: "unverified",
      revision: 1,
      retention: memoryRetentionForScope(state.scope),
    },
  });
  return { id: record.id, title: record.title, scope: record.scope };
}

/** The Agent-facing tool definition; registered through the public tool registry. */
export function createMemoryProposeTool(memoryDomain: WorkspaceMemoryDomain) {
  return defineTool({
    name: MEMORY_PROPOSE_TOOL_NAME,
    description: "Propose a durable project decision, preference, convention, or fact for the user to review and keep in local Workspace Memory. Proposals are stored unverified and are never injected into the model context automatically; the user must confirm them.",
    parameters: {
      scope: { type: "string", description: "Target scope: project (default) or session." },
      type: { type: "string", required: true, description: "Record type: decision, preference, convention, or fact." },
      title: { type: "string", required: true, description: "Short title (max 256 bytes)." },
      content: { type: "string", required: true, description: "Content (max 64 KiB)." },
      tags: { type: "array", items: { type: "string" }, description: "Optional tags." },
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }],
    },
    async execute(args, exec) {
      const agent = exec.agent as MemoryHostAgent | undefined;
      if (!agent) throw new MemoryStoreError("PROJECT_UNAVAILABLE", "Memory proposals require an active session");
      const saved = await proposeMemory(memoryDomain, agent, args as MemoryProposeArgs, exec.callId);
      return `Saved memory proposal "${saved.title}" (${saved.scope} scope) for your review. It is not injected into context until the user verifies it.`;
    },
  });
}

const PROMPT_SECTION_TEXT = `## Workspace Memory proposals

This workspace keeps local Memory: durable project decisions, preferences, conventions, and facts the user should remember across sessions. When you establish or change such a fact — a stable decision, a user preference, a coding convention, or a durable project fact — propose it with the \`workspace_memory_propose\` tool. Proposals are stored unverified for the user to review and verify; they are never injected into context automatically. Do not propose transient details, secrets, credentials, or facts the user can trivially re-derive.`;

/**
 * Register the propose tool and its system-prompt guidance against the
 * shared Memory domain (the same instance the Host RPC service uses, so
 * proposals are visible to the Web surface immediately). Returns a disposer.
 */
export function registerMemoryPropose(ctx: Context, memoryDomain: WorkspaceMemoryDomain): () => void {
  const disposers: (() => void)[] = [];
  disposers.push(ctx.tools.register(createMemoryProposeTool(memoryDomain)));
  disposers.push(ctx.systemPrompt.section({ name: MEMORY_PROPOSE_SECTION, order: 120, text: PROMPT_SECTION_TEXT }));
  return () => { for (const dispose of disposers.reverse()) dispose(); };
}
