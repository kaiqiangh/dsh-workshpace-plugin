export declare const WORKSPACE_SUMMARY_EVENT: "workspace/summary";
export declare const WORKSPACE_CONVERSATION_KIND: "dsh-workspace-summary";
export declare const WORKSPACE_CONVERSATION_TARGET: "chat";
export declare const WORKSPACE_CHAT_SLOT: "conversation.chat.node";
export interface WorkspaceChatData {
    readonly filesTouched: number;
    readonly changes: number;
    readonly artifacts: number;
    readonly workspaceName: string;
    /** Files whose last observed activity was a create. */
    readonly filesCreated: number;
    /** Files whose last observed activity was an edit. */
    readonly filesModified: number;
    /** Files whose last observed activity was a delete. */
    readonly filesDeleted: number;
    /** Earliest observed activity timestamp in the session (0 when none). */
    readonly firstObservedAt: number;
    /** Latest observed activity timestamp in the session (0 when none). */
    readonly lastObservedAt: number;
    /** Active-scope Memory records (session scope). */
    readonly memoryCount: number;
    /** Active-scope `decision` Memory records (session scope). */
    readonly decisionCount: number;
}
export interface WorkspaceSummaryEventData {
    readonly id: string;
    readonly phase: "start" | "update";
    readonly summary: WorkspaceChatData;
}
export interface WorkspaceSummaryEvent {
    readonly type: typeof WORKSPACE_SUMMARY_EVENT;
    readonly seq: number;
    readonly data: WorkspaceSummaryEventData;
}
export interface WorkspaceConversationMatch {
    readonly event: WorkspaceSummaryEvent;
    readonly role: "start" | "update";
    readonly id: string;
}
export interface WorkspaceConversationContext {
    readonly key: string;
    readonly kind: string;
    readonly id: string;
    readonly start: WorkspaceConversationMatch | undefined;
    readonly state: WorkspaceChatData | undefined;
}
export interface WorkspaceChatViewNode {
    readonly key: string;
    readonly kind: typeof WORKSPACE_CONVERSATION_KIND;
    readonly id: string;
    readonly target: typeof WORKSPACE_CONVERSATION_TARGET;
    readonly data: WorkspaceChatData;
    readonly anchorSeq: number;
    readonly location: {
        readonly kind: "session";
    };
    readonly visibility: "visible";
}
export interface WorkspaceConversationDefinition {
    readonly kind: typeof WORKSPACE_CONVERSATION_KIND;
    readonly target: typeof WORKSPACE_CONVERSATION_TARGET;
    readonly match: (event: WorkspaceSummaryEvent) => {
        readonly id: string;
        readonly role: "start" | "update";
    } | null;
    readonly start: (context: WorkspaceConversationContext, match: WorkspaceConversationMatch) => WorkspaceChatData;
    readonly update: (context: WorkspaceConversationContext & {
        readonly state: WorkspaceChatData;
    }, match: WorkspaceConversationMatch) => WorkspaceChatData;
    readonly buildViewNode: (context: WorkspaceConversationContext) => WorkspaceChatViewNode | null;
}
export interface WorkspaceConversationViewSnapshot {
    readonly order: readonly string[];
    readonly nodes: ReadonlyMap<string, WorkspaceChatViewNode>;
    readonly timeline: WorkspaceConversationTimeline;
}
export interface WorkspaceConversationTimeline {
    readonly turnOrder: readonly number[];
    readonly turns: ReadonlyMap<number, unknown>;
}
export interface WorkspaceConversationViewBuilder {
    readonly empty: WorkspaceConversationViewSnapshot;
    replace(input: {
        readonly nodes: readonly WorkspaceChatViewNode[];
        readonly timeline: WorkspaceConversationTimeline;
    }): WorkspaceConversationViewSnapshot;
    apply(input: {
        readonly upserts: readonly WorkspaceChatViewNode[];
        readonly timeline: WorkspaceConversationTimeline;
    }): WorkspaceConversationViewSnapshot;
}
export interface WorkspaceConversationViewDefinition {
    readonly target: typeof WORKSPACE_CONVERSATION_TARGET;
    create(): WorkspaceConversationViewBuilder;
}
export interface WorkspaceSummaryCardModel {
    readonly summary: WorkspaceChatData;
}
export type WorkspaceSummaryRenderer = (model: WorkspaceSummaryCardModel) => unknown;
export interface WorkspaceChatNodeProps {
    readonly node: WorkspaceChatViewNode;
}
export type WorkspaceChatNodeComponent = (props: WorkspaceChatNodeProps) => unknown;
export interface WorkspaceWebError {
    readonly code: "INTEGRATION_UNAVAILABLE" | "LOCAL_OPERATION_FAILED";
    readonly operation?: string;
    readonly message: string;
}
export declare class WorkspaceWebIntegrationError extends Error {
    readonly code: WorkspaceWebError["code"];
    constructor(code: WorkspaceWebError["code"], message: string);
}
export declare const workspaceConversationDefinition: WorkspaceConversationDefinition;
export declare const workspaceConversationView: WorkspaceConversationViewDefinition;
export declare function createWorkspaceSummaryCard(summary: WorkspaceChatData): WorkspaceSummaryCardModel;
export declare function createWorkspaceChatNodeComponent(render: WorkspaceSummaryRenderer): WorkspaceChatNodeComponent;
export interface WorkspaceConversationEventRegistry {
    readonly register: (definition: WorkspaceConversationDefinition) => () => void;
}
export interface WorkspaceConversationViewRegistry {
    readonly register: (definition: WorkspaceConversationViewDefinition) => () => void;
}
export interface WorkspaceSlotRegistry {
    readonly inject: (key: typeof WORKSPACE_CHAT_SLOT, callback: () => () => void) => () => void;
    readonly register: (options: {
        readonly name: typeof WORKSPACE_CHAT_SLOT;
        readonly key: typeof WORKSPACE_CONVERSATION_KIND;
        readonly priority?: number;
    }, component: WorkspaceChatNodeComponent) => () => void;
}
export interface WorkspaceConversationContributionContext {
    readonly conversationEvents: WorkspaceConversationEventRegistry;
    readonly conversationViews: WorkspaceConversationViewRegistry;
    readonly slots: WorkspaceSlotRegistry;
    readonly effect: (factory: () => void | (() => void), label?: string) => void;
}
export interface WorkspaceConversationContributionOptions {
    readonly renderSummary: WorkspaceSummaryRenderer;
}
export declare function applyWorkspaceConversationContribution(ctx: WorkspaceConversationContributionContext, options: WorkspaceConversationContributionOptions): void;
