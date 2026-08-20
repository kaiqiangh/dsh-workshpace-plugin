import { type ReactNode } from "react";
import type { WorkspaceSurfaceComponent } from "./workspace-styles.ts";
/** The public Harness conversation view ring: one list entry per view tab. */
export declare const WORKSPACE_VIEW_SLOT: "conversation.view";
export declare const WORKSPACE_VIEW_ENTRY_KEY: "dsh-workspace";
export declare const WORKSPACE_VIEW_ORDER: 20;
export declare const WORKSPACE_VIEW_LABEL: "Workspace";
export declare const WORKSPACE_VIEW_LOCALE_NS: "dsh-workspace";
/**
 * Props the view body receives from the rc.7 `register.inject(sessionId)`
 * seat. The conversation.view hole is session-scoped (children of
 * `conversation.session` with `scope: "session"`), so the shell passes the
 * active session id into `inject`; we surface it back as the `useSessions`
 * seat the surfaces already read (dsh-web-ui trajectory pattern).
 */
export interface WorkspaceConversationViewInjectedProps {
    readonly useSessions: () => string | undefined;
}
export interface WorkspaceConversationViewRegistration {
    readonly name: typeof WORKSPACE_VIEW_SLOT;
    readonly id: typeof WORKSPACE_VIEW_ENTRY_KEY;
    readonly order: typeof WORKSPACE_VIEW_ORDER;
    readonly locale: typeof WORKSPACE_VIEW_LOCALE_NS;
    readonly label: () => string;
    readonly inject: (sessionId: string) => WorkspaceConversationViewInjectedProps;
}
/** Pinned registration descriptor; the client contribution registers this into `conversation.view`. */
export declare function workspaceConversationViewRegistration(): WorkspaceConversationViewRegistration;
/**
 * Structural face of the Harness slot registry for the `conversation.view`
 * slot. Mirrors the existing `WorkspaceOverlaySlotRegistry` cast: the slot
 * row is declared by `@deepseek-ai/dsh-client-ui-conversation` at runtime,
 * and the plugin types it structurally so no first-party package is required.
 */
export interface WorkspaceViewSlotRegistry {
    readonly inject: (key: typeof WORKSPACE_VIEW_SLOT, callback: () => () => void) => () => void;
    readonly register: (options: WorkspaceConversationViewRegistration, component: WorkspaceSurfaceComponent) => () => void;
}
export interface WorkspaceConversationViewOptions {
    readonly artifacts: WorkspaceSurfaceComponent;
    readonly memory: WorkspaceSurfaceComponent;
    readonly git: WorkspaceSurfaceComponent;
    /** Optional read-only summary block rendered above the surface tabs. */
    readonly summary?: WorkspaceSurfaceComponent;
}
/**
 * Conversation view tab body: the Artifacts/Memory/Git switch rendered in the
 * tab row's body (IA #125: tab order Artifacts → Memory → Git; the Git tab
 * hosts the Changes/History segmented switch internally). Session-scoped slot
 * components receive the global `useSessions` seat, which the surfaces already
 * read, so no remote-resolution changes are needed.
 */
export declare function createWorkspaceConversationViewComponent(options: WorkspaceConversationViewOptions): (props: Record<string, unknown>) => ReactNode;
