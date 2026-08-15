import { type WorkspacePath } from "../domain/path.ts";
import { type DrawerAction, type DrawerEffect, type DrawerState, type PinnedContextSummary, type WorkingSetSummary } from "./workspace-drawer.ts";
export declare const WORKSPACE_SUMMARY_EVENT: "workspace/summary";
export declare const WORKSPACE_CONVERSATION_KIND: "dsh-workspace-summary";
export declare const WORKSPACE_CONVERSATION_TARGET: "chat";
export declare const WORKSPACE_CHAT_SLOT: "conversation.chat.node";
export interface WorkspaceChatData {
    readonly filesTouched: number;
    readonly changes: number;
    readonly artifacts: number;
    readonly workspaceName: string;
}
export interface WorkspacePreviewDescriptor {
    readonly type: string;
    readonly path?: WorkspacePath;
    readonly message?: string;
    readonly [key: string]: unknown;
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
    readonly openWorkspace: {
        readonly label: "Open Workspace";
        readonly action: () => void;
    };
}
export type WorkspaceSummaryRenderer = (model: WorkspaceSummaryCardModel) => unknown;
export interface WorkspaceChatNodeProps {
    readonly node: WorkspaceChatViewNode;
}
export type WorkspaceChatNodeComponent = (props: WorkspaceChatNodeProps) => unknown;
export interface WorkspaceDirectoryEntry {
    readonly path: WorkspacePath;
    readonly name: string;
    readonly kind: "file" | "directory" | "symlink";
    readonly size?: number;
    readonly modifiedAt?: number;
}
export interface WorkspaceFileStat {
    readonly path: WorkspacePath;
    readonly kind: "file" | "directory" | "symlink";
    readonly size?: number;
    readonly modifiedAt?: number;
}
export interface WorkspaceChange {
    readonly path: WorkspacePath;
    readonly status: string;
    readonly previousPath?: WorkspacePath;
}
export interface WorkspaceSessionFile {
    readonly path: WorkspacePath;
    readonly current: "present" | "deleted" | "unknown";
    readonly observations: number;
    readonly attribution: string;
}
export interface WorkspaceWorkingSet {
    readonly entries: readonly {
        readonly path: WorkspacePath;
        readonly unresolved: boolean;
    }[];
    readonly summary: WorkingSetSummary;
}
export type WorkspacePinnedContext = PinnedContextSummary;
export interface WorkspaceHostClient {
    readonly listDirectory: (path: WorkspacePath) => Promise<readonly WorkspaceDirectoryEntry[]>;
    readonly stat: (path: WorkspacePath) => Promise<WorkspaceFileStat>;
    readonly preview: (path: WorkspacePath) => Promise<WorkspacePreviewDescriptor>;
    readonly readResource: (resourceId: string) => Promise<Uint8Array>;
    readonly gitStatus: () => Promise<readonly WorkspaceChange[]>;
    readonly diff: (path?: WorkspacePath) => Promise<string>;
    readonly sessionFiles: () => Promise<readonly WorkspaceSessionFile[]>;
    readonly workingSet: () => Promise<WorkspaceWorkingSet>;
    readonly pinWorkingSet: (path: WorkspacePath) => Promise<void>;
    readonly unpinWorkingSet: (path: WorkspacePath) => Promise<void>;
    readonly clearWorkingSet: () => Promise<void>;
    readonly sendWorkingSet: () => Promise<void>;
    readonly pinnedContext: () => Promise<WorkspacePinnedContext>;
    readonly pinContext: (path: WorkspacePath) => Promise<WorkspacePinnedContext>;
    readonly unpinContext: (path: WorkspacePath) => Promise<WorkspacePinnedContext>;
    readonly clearContext: () => Promise<WorkspacePinnedContext>;
}
export interface WorkspaceWebError {
    readonly code: "INTEGRATION_UNAVAILABLE" | "LOCAL_OPERATION_FAILED";
    readonly operation?: string;
    readonly message: string;
}
export declare class WorkspaceWebIntegrationError extends Error {
    readonly code: WorkspaceWebError["code"];
    constructor(code: WorkspaceWebError["code"], message: string);
}
export interface WorkspaceDrawerController {
    readonly getState: () => DrawerState;
    readonly dispatch: (action: DrawerAction) => Promise<WorkspaceDrawerDispatchResult>;
    readonly handleKey: (key: string) => Promise<WorkspaceDrawerDispatchResult>;
    readonly listDirectory: WorkspaceHostClient["listDirectory"];
    readonly preview: WorkspaceHostClient["preview"];
    readonly readResource: WorkspaceHostClient["readResource"];
    readonly diff: WorkspaceHostClient["diff"];
    readonly sessionFiles: WorkspaceHostClient["sessionFiles"];
    readonly gitStatus: WorkspaceHostClient["gitStatus"];
    readonly workingSet: WorkspaceHostClient["workingSet"];
    readonly pinnedContext: WorkspaceHostClient["pinnedContext"];
}
export interface WorkspaceDrawerDispatchResult {
    readonly state: DrawerState;
    readonly effect?: DrawerEffect;
    readonly data?: WorkspacePreviewDescriptor | WorkspacePinnedContext | string;
    readonly error?: WorkspaceWebError;
}
export type WorkspaceSurfaceLayout = {
    readonly mode: "desktop" | "narrow";
    readonly chatVisible: boolean;
    readonly drawer: "right-side" | "full-width";
};
export declare const workspaceKeyboardControls: readonly ["open-workspace", "close-workspace", "Files", "Session", "Changes", "Context", "preview", "pin-working-set", "unpin-working-set", "clear-working-set", "send-working-set", "inspect-pinned-context", "pin-context", "unpin-context", "clear-context"];
export declare const workspaceConversationDefinition: WorkspaceConversationDefinition;
export declare const workspaceConversationView: WorkspaceConversationViewDefinition;
export declare function createWorkspaceSummaryCard(summary: WorkspaceChatData, openWorkspace: () => void): WorkspaceSummaryCardModel;
export declare function createWorkspaceChatNodeComponent(render: WorkspaceSummaryRenderer, openWorkspace: () => void): WorkspaceChatNodeComponent;
export declare function createWorkspaceDrawerController(client: WorkspaceHostClient, initialState?: DrawerState): WorkspaceDrawerController;
export declare function workspaceSurfaceLayout(viewportWidth: number, breakpoint?: number): WorkspaceSurfaceLayout;
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
    readonly openWorkspace: () => void;
}
export declare function applyWorkspaceConversationContribution(ctx: WorkspaceConversationContributionContext, options: WorkspaceConversationContributionOptions): void;
export declare function normalizeWorkspaceOperationPath(path: string): WorkspacePath;
