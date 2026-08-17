import { type ReactNode } from "react";
import type { WorkspaceSurfaceComponent } from "./workspace-styles.ts";
/** The public Harness conversation view ring: one list entry per view tab. */
export declare const WORKSPACE_VIEW_SLOT: "conversation.view";
export declare const WORKSPACE_VIEW_ENTRY_KEY: "dsh-workspace";
export declare const WORKSPACE_VIEW_ORDER: 20;
export declare const WORKSPACE_VIEW_LABEL: "Workspace";
export interface WorkspaceConversationViewRegistration {
    readonly name: typeof WORKSPACE_VIEW_SLOT;
    readonly id: typeof WORKSPACE_VIEW_ENTRY_KEY;
    readonly order: typeof WORKSPACE_VIEW_ORDER;
    readonly label: typeof WORKSPACE_VIEW_LABEL;
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
    readonly changes: WorkspaceSurfaceComponent;
    /** Optional read-only summary block rendered above the surface tabs. */
    readonly summary?: WorkspaceSurfaceComponent;
}
/**
 * Conversation view tab body: the Artifacts/Memory/Changes switch rendered in
 * the tab row's body, reusing the existing surfaces unchanged. Session-scoped
 * slot components receive the global `useSessions` seat, which the surfaces
 * already read, so no remote-resolution changes are needed.
 */
export declare function createWorkspaceConversationViewComponent(options: WorkspaceConversationViewOptions): (props: Record<string, unknown>) => ReactNode;
