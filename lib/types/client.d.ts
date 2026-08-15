import { applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, createWorkspaceDrawerController, type WorkspaceConversationEventRegistry, type WorkspaceConversationViewRegistry, type WorkspaceConversationContributionOptions, type WorkspaceSlotRegistry, workspaceConversationDefinition, workspaceConversationView } from "./web/workspace-conversation.ts";
import type { TypertClientRemote } from "@deepseek-ai/dsh-typert-protocol";
interface ClientContributionContext {
    readonly conversationEvents: WorkspaceConversationEventRegistry;
    readonly conversationViews: WorkspaceConversationViewRegistry;
    readonly slots: WorkspaceSlotRegistry;
    readonly effect: (factory: () => void | (() => void), label?: string) => void;
    readonly remote: TypertClientRemote;
    readonly emit: (event: string, ...args: readonly unknown[]) => void;
}
declare module "@deepseek-ai/cordis" {
    interface Events {
        "workspace/open"(): void;
    }
}
/** @typert object */
export interface WorkspaceClientSurface {
    readonly ready: boolean;
}
export declare const workspaceClient: WorkspaceClientSurface;
export declare function apply(ctx: ClientContributionContext): Promise<() => Promise<void>>;
export { applyWorkspaceConversationContribution, createWorkspaceChatNodeComponent, createWorkspaceDrawerController, workspaceConversationDefinition, workspaceConversationView, };
export type { WorkspaceConversationContributionOptions };
