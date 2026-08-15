import { type PinnedContextSnapshot, type PinnedContextState } from "./context.ts";
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
    readonly ctx?: {
        readonly systemPrompt?: HarnessPromptRegistry;
    };
}
export interface PinnedContextCarrierOptions {
    readonly name?: string;
    readonly order?: number;
}
export type PinnedContextCarrierErrorCode = "AGENT_INVALID" | "IDENTITY_MISMATCH" | "UNSUPPORTED" | "REGISTRATION_FAILED" | "DISPOSED";
export declare class PinnedContextCarrierError extends Error {
    readonly code: PinnedContextCarrierErrorCode;
    constructor(code: PinnedContextCarrierErrorCode, message: string);
}
export interface PinnedContextCarrier {
    /** Replace the next assembly's snapshot without waking or steering the Agent. */
    update(state: PinnedContextState): void;
    /** Host-only snapshot inspection; use pinnedContextMetadata for Web projection. */
    snapshot(): PinnedContextSnapshot;
    /** Dispose the public registration and reject later updates. */
    dispose(): void;
}
/**
 * Register one agent-scoped dynamic context provider on the public Harness seam.
 * The provider closes over the current snapshot, so updates replace one named
 * runtime-context contribution instead of appending messages or waking the Agent.
 */
export declare function registerPinnedContextCarrier(agent: HarnessContextAgent, state: PinnedContextState, options?: PinnedContextCarrierOptions): PinnedContextCarrier;
