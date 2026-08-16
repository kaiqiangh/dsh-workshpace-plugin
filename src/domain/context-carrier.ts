import {
  renderPinnedContext,
  type PinnedContextSnapshot,
  type PinnedContextState,
} from "./context.ts";

const defaultContextName = "dsh-workspace:pinned-context";
const defaultContextOrder = 120;
const producerLabel = "DSH Workspace Pinned Context";

export interface HarnessPromptContextRegistration {
  readonly name: string;
  readonly order: number;
  /** The provider intentionally ignores assembly context; `never` makes that explicit at the seam. */
  readonly text: string | ((context: never) => string);
}

export interface HarnessPromptRegistry {
  context(registration: HarnessPromptContextRegistration): () => void;
}

export interface HarnessContextAgent {
  readonly id: string;
  readonly ctx?: { readonly systemPrompt?: HarnessPromptRegistry };
}

export interface PinnedContextCarrierOptions {
  readonly name?: string;
  readonly order?: number;
}

export type PinnedContextCarrierErrorCode =
  | "AGENT_INVALID"
  | "IDENTITY_MISMATCH"
  | "UNSUPPORTED"
  | "REGISTRATION_FAILED"
  | "DISPOSED";

export class PinnedContextCarrierError extends Error {
  readonly code: PinnedContextCarrierErrorCode;

  constructor(code: PinnedContextCarrierErrorCode, message: string) {
    super(message);
    this.name = "PinnedContextCarrierError";
    this.code = code;
  }
}

export interface PinnedContextCarrier {
  /** Replace the next assembly's snapshot without waking or steering the Agent. */
  update(state: PinnedContextState): void;
  /** Host-only snapshot inspection; use pinnedContextMetadata for Web projection. */
  snapshot(): PinnedContextSnapshot;
  /** Dispose the public registration and reject later updates. */
  dispose(): void;
}

function assertStateIdentity(agent: HarnessContextAgent, state: PinnedContextState, boundRootId?: string): void {
  if (agent.id !== state.identity.sessionId || (boundRootId !== undefined && boundRootId !== state.identity.rootId)) {
    throw new PinnedContextCarrierError("IDENTITY_MISMATCH", "Harness Agent does not match the Workspace Session");
  }
}

function carrierText(snapshot: PinnedContextSnapshot): string {
  return snapshot.text === "" ? "" : `Producer: ${producerLabel}\n${snapshot.text}`;
}

/**
 * Register one agent-scoped dynamic context provider on the public Harness seam.
 * The provider closes over the current snapshot, so updates replace one named
 * runtime-context contribution instead of appending messages or waking the Agent.
 */
export function registerPinnedContextCarrier(
  agent: HarnessContextAgent,
  state: PinnedContextState,
  options?: PinnedContextCarrierOptions,
): PinnedContextCarrier {
  if (!agent || typeof agent !== "object" || typeof agent.id !== "string") {
    throw new PinnedContextCarrierError("AGENT_INVALID", "Harness Agent is invalid");
  }
  assertStateIdentity(agent, state);
  const boundRootId = state.identity.rootId;
  const systemPrompt = agent.ctx?.systemPrompt;
  if (!systemPrompt || typeof systemPrompt.context !== "function") {
    throw new PinnedContextCarrierError("UNSUPPORTED", "Harness public system-prompt context API is unavailable");
  }

  let current = renderPinnedContext(state);
  let disposed = false;
  let unregister: (() => void);
  try {
    const disposer = systemPrompt.context({
      name: options?.name ?? defaultContextName,
      order: options?.order ?? defaultContextOrder,
      text: () => carrierText(current),
    });
    if (typeof disposer !== "function") throw new Error("missing disposer");
    unregister = disposer;
  } catch {
    throw new PinnedContextCarrierError("REGISTRATION_FAILED", "Harness context registration failed");
  }

  return {
    update(nextState) {
      if (disposed) throw new PinnedContextCarrierError("DISPOSED", "Pinned Context carrier is disposed");
      assertStateIdentity(agent, nextState, boundRootId);
      current = renderPinnedContext(nextState);
    },
    snapshot() {
      return current;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unregister();
    },
  };
}
