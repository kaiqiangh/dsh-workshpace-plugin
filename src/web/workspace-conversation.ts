import { normalizeWorkspacePath, type WorkspacePath } from "../domain/workspace.ts";
import type { PreviewDescriptor } from "../domain/preview.ts";
import {
  createDrawerState,
  reduceDrawer,
  type DrawerAction,
  type DrawerEffect,
  type DrawerState,
  type WorkingSetSummary,
} from "./workspace-drawer.ts";

export const WORKSPACE_SUMMARY_EVENT = "workspace/summary" as const;
export const WORKSPACE_CONVERSATION_KIND = "dsh-workspace-summary" as const;
export const WORKSPACE_CONVERSATION_TARGET = "chat" as const;
export const WORKSPACE_CHAT_SLOT = "conversation.chat.node" as const;

export interface WorkspaceChatData {
  readonly filesTouched: number;
  readonly changes: number;
  readonly artifacts: number;
  readonly workspaceName: string;
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
  readonly summary: WorkspaceChatData;
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
  readonly location: { readonly kind: "session" };
  readonly visibility: "visible";
}

export interface WorkspaceConversationDefinition {
  readonly kind: typeof WORKSPACE_CONVERSATION_KIND;
  readonly target: typeof WORKSPACE_CONVERSATION_TARGET;
  readonly match: (event: WorkspaceSummaryEvent) => { readonly id: string; readonly role: "start" | "update" } | null;
  readonly start: (context: WorkspaceConversationContext, match: WorkspaceConversationMatch) => WorkspaceChatData;
  readonly update: (context: WorkspaceConversationContext & { readonly state: WorkspaceChatData }, match: WorkspaceConversationMatch) => WorkspaceChatData;
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
  replace(input: { readonly nodes: readonly WorkspaceChatViewNode[]; readonly timeline: WorkspaceConversationTimeline }): WorkspaceConversationViewSnapshot;
  apply(input: { readonly upserts: readonly WorkspaceChatViewNode[]; readonly timeline: WorkspaceConversationTimeline }): WorkspaceConversationViewSnapshot;
}

export interface WorkspaceConversationViewDefinition {
  readonly target: typeof WORKSPACE_CONVERSATION_TARGET;
  create(): WorkspaceConversationViewBuilder;
}

export interface WorkspaceSummaryCardModel {
  readonly summary: WorkspaceChatData;
  readonly openWorkspace: { readonly label: "Open Workspace"; readonly action: () => void };
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
  readonly entries: readonly { readonly path: WorkspacePath; readonly unresolved: boolean }[];
  readonly summary: WorkingSetSummary;
}

export interface WorkspaceHostClient {
  readonly listDirectory: (path: WorkspacePath) => Promise<readonly WorkspaceDirectoryEntry[]>;
  readonly stat: (path: WorkspacePath) => Promise<WorkspaceFileStat>;
  readonly preview: (path: WorkspacePath) => Promise<PreviewDescriptor>;
  readonly readResource: (resourceId: string) => Promise<Uint8Array>;
  readonly gitStatus: () => Promise<readonly WorkspaceChange[]>;
  readonly diff: (path?: WorkspacePath) => Promise<string>;
  readonly sessionFiles: () => Promise<readonly WorkspaceSessionFile[]>;
  readonly workingSet: () => Promise<WorkspaceWorkingSet>;
  readonly pinWorkingSet: (path: WorkspacePath) => Promise<void>;
  readonly unpinWorkingSet: (path: WorkspacePath) => Promise<void>;
  readonly clearWorkingSet: () => Promise<void>;
  readonly sendWorkingSet: () => Promise<void>;
}

export interface WorkspaceWebError {
  readonly code: "INTEGRATION_UNAVAILABLE" | "LOCAL_OPERATION_FAILED";
  readonly operation?: string;
  readonly message: string;
}

export class WorkspaceWebIntegrationError extends Error {
  readonly code: WorkspaceWebError["code"];

  constructor(code: WorkspaceWebError["code"], message: string) {
    super(message);
    this.name = "WorkspaceWebIntegrationError";
    this.code = code;
  }
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
}

export interface WorkspaceDrawerDispatchResult {
  readonly state: DrawerState;
  readonly effect?: DrawerEffect;
  readonly data?: PreviewDescriptor | string;
  readonly error?: WorkspaceWebError;
}

export type WorkspaceSurfaceLayout = {
  readonly mode: "desktop" | "narrow";
  readonly chatVisible: boolean;
  readonly drawer: "right-side" | "full-width";
};

export const workspaceKeyboardControls = [
  "open-workspace",
  "close-workspace",
  "Files",
  "Session",
  "Changes",
  "preview",
  "pin-working-set",
  "unpin-working-set",
  "clear-working-set",
  "send-working-set",
] as const;

function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validWorkspaceName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validSummary(value: unknown): value is WorkspaceChatData {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<WorkspaceChatData>;
  return validCount(summary.filesTouched) && validCount(summary.changes) && validCount(summary.artifacts) && validWorkspaceName(summary.workspaceName);
}

function eventData(value: unknown): WorkspaceSummaryEventData | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Partial<WorkspaceSummaryEventData>;
  if (typeof data.id !== "string" || !data.id.trim() || data.id.length > 200 || /[\u0000-\u001f\u007f]/u.test(data.id) || (data.phase !== "start" && data.phase !== "update") || !validSummary(data.summary)) return undefined;
  return { id: data.id, phase: data.phase, summary: data.summary };
}

function validateWorkspaceEvent(event: WorkspaceSummaryEvent): WorkspaceSummaryEventData | undefined {
  if (!event || typeof event !== "object" || event.type !== WORKSPACE_SUMMARY_EVENT || !Number.isSafeInteger(event.seq)) return undefined;
  return eventData(event.data);
}

export const workspaceConversationDefinition: WorkspaceConversationDefinition = {
  kind: WORKSPACE_CONVERSATION_KIND,
  target: WORKSPACE_CONVERSATION_TARGET,
  match(event) {
    const data = validateWorkspaceEvent(event);
    return data ? { id: data.id, role: data.phase } : null;
  },
  start(_context, match) {
    return match.summary;
  },
  update(_context, match) {
    return match.summary;
  },
  buildViewNode(context) {
    if (!context.state) return null;
    return {
      key: context.key,
      kind: WORKSPACE_CONVERSATION_KIND,
      id: context.id,
      target: WORKSPACE_CONVERSATION_TARGET,
      data: context.state,
      anchorSeq: context.start?.event.seq ?? 0,
      location: { kind: "session" },
      visibility: "visible",
    };
  },
};

export const workspaceConversationView: WorkspaceConversationViewDefinition = {
  target: WORKSPACE_CONVERSATION_TARGET,
  create(): WorkspaceConversationViewBuilder {
    const empty: WorkspaceConversationViewSnapshot = { order: [], nodes: new Map(), timeline: { turnOrder: [], turns: new Map() } };
    let snapshot: WorkspaceConversationViewSnapshot = empty;
    return {
      empty,
      replace({ nodes, timeline }) {
        const order = nodes.map((node) => node.key);
        snapshot = { order, nodes: new Map(nodes.map((node) => [node.key, node])), timeline };
        return snapshot;
      },
      apply({ upserts, timeline }) {
        const nodes = new Map(snapshot.nodes);
        const order = [...snapshot.order];
        for (const node of upserts) {
          if (!nodes.has(node.key)) order.push(node.key);
          nodes.set(node.key, node);
        }
        snapshot = { order, nodes, timeline };
        return snapshot;
      },
    };
  },
};

export function createWorkspaceSummaryCard(summary: WorkspaceChatData, openWorkspace: () => void): WorkspaceSummaryCardModel {
  if (!validSummary(summary)) throw new WorkspaceWebIntegrationError("LOCAL_OPERATION_FAILED", "Workspace summary is invalid");
  return { summary, openWorkspace: { label: "Open Workspace", action: openWorkspace } };
}

export function createWorkspaceChatNodeComponent(render: WorkspaceSummaryRenderer, openWorkspace: () => void): WorkspaceChatNodeComponent {
  return ({ node }) => render(createWorkspaceSummaryCard(node.data, openWorkspace));
}

export function createWorkspaceDrawerController(
  client: WorkspaceHostClient,
  initialState: DrawerState = createDrawerState(),
): WorkspaceDrawerController {
  let state = initialState;
  const dispatchEffect = async (effect: DrawerEffect): Promise<void> => {
    if (effect === "send-working-set") return client.sendWorkingSet();
    if (effect === "clear-working-set") return client.clearWorkingSet();
    if (effect.type === "pin-working-set") return client.pinWorkingSet(effect.path);
    return client.unpinWorkingSet(effect.path);
  };
  const controller: WorkspaceDrawerController = {
    getState: () => state,
    listDirectory: client.listDirectory,
    preview: client.preview,
    readResource: client.readResource,
    diff: client.diff,
    sessionFiles: client.sessionFiles,
    gitStatus: client.gitStatus,
    workingSet: client.workingSet,
    async dispatch(action) {
      const reduced = reduceDrawer(state, action);
      state = reduced.state;
      if (action.type === "select-file" || action.type === "select-artifact") {
        const target = state.preview.target;
        if (target.type !== "file") return reduced;
        try {
          const data = await client.preview(target.path);
          if (data.type === "error") {
            state = reduceDrawer(state, { type: "set-preview", panel: { status: "error", message: data.message } }).state;
            return { state, data, error: { code: "LOCAL_OPERATION_FAILED", operation: "preview", message: data.message } };
          }
          return { ...reduced, state, data };
        } catch {
          state = reduceDrawer(state, { type: "set-preview", panel: { status: "error", message: "Preview is unavailable" } }).state;
          return { state, error: { code: "LOCAL_OPERATION_FAILED", operation: "preview", message: "Preview is unavailable" } };
        }
      }
      if (action.type === "select-change") {
        const target = state.preview.target;
        if (target.type !== "change") return reduced;
        try {
          return { ...reduced, state, data: await client.diff(target.path) };
        } catch {
          state = reduceDrawer(state, { type: "set-preview", panel: { status: "error", message: "Change preview is unavailable" } }).state;
          return { state, error: { code: "LOCAL_OPERATION_FAILED", operation: "diff", message: "Change preview is unavailable" } };
        }
      }
      if (!reduced.effect) return reduced;
      try {
        await dispatchEffect(reduced.effect);
        return reduced;
      } catch {
        return {
          state,
          effect: reduced.effect,
          error: { code: "LOCAL_OPERATION_FAILED", operation: reduced.effect === "send-working-set" || reduced.effect === "clear-working-set" ? reduced.effect : reduced.effect.type, message: "Workspace action could not be completed" },
        };
      }
    },
    async handleKey(key) {
      if (key !== "Escape") return { state };
      return controller.dispatch({ type: "escape" });
    },
  };
  return controller;
}

export function workspaceSurfaceLayout(viewportWidth: number, breakpoint = 760): WorkspaceSurfaceLayout {
  if (!Number.isFinite(viewportWidth) || viewportWidth < 0 || !Number.isSafeInteger(breakpoint) || breakpoint < 1) {
    throw new WorkspaceWebIntegrationError("LOCAL_OPERATION_FAILED", "Workspace viewport is invalid");
  }
  return viewportWidth <= breakpoint
    ? { mode: "narrow", chatVisible: false, drawer: "full-width" }
    : { mode: "desktop", chatVisible: true, drawer: "right-side" };
}

export interface WorkspaceConversationEventRegistry {
  readonly register: (definition: WorkspaceConversationDefinition) => () => void;
}

export interface WorkspaceConversationViewRegistry {
  readonly register: (definition: WorkspaceConversationViewDefinition) => () => void;
}

export interface WorkspaceSlotRegistry {
  readonly inject: (key: typeof WORKSPACE_CHAT_SLOT, callback: () => () => void) => () => void;
  readonly register: (options: { readonly name: typeof WORKSPACE_CHAT_SLOT; readonly key: typeof WORKSPACE_CONVERSATION_KIND; readonly priority?: number }, component: WorkspaceChatNodeComponent) => () => void;
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

export function applyWorkspaceConversationContribution(
  ctx: WorkspaceConversationContributionContext,
  options: WorkspaceConversationContributionOptions,
): void {
  if (!ctx?.conversationEvents || !ctx.conversationViews || !ctx.slots || typeof ctx.effect !== "function") {
    throw new WorkspaceWebIntegrationError("INTEGRATION_UNAVAILABLE", "Public DSH Web conversation seam is unavailable");
  }
  if (typeof options?.renderSummary !== "function" || typeof options.openWorkspace !== "function") {
    throw new WorkspaceWebIntegrationError("INTEGRATION_UNAVAILABLE", "Workspace summary renderer is unavailable");
  }
  ctx.effect(() => {
    const disposeEvent = ctx.conversationEvents.register(workspaceConversationDefinition);
    const disposeView = ctx.conversationViews.register(workspaceConversationView);
    const disposeSlot = ctx.slots.inject(WORKSPACE_CHAT_SLOT, () => ctx.slots.register(
      { name: WORKSPACE_CHAT_SLOT, key: WORKSPACE_CONVERSATION_KIND },
      createWorkspaceChatNodeComponent(options.renderSummary, options.openWorkspace),
    ));
    return () => {
      disposeSlot();
      disposeView();
      disposeEvent();
    };
  }, "workspace conversation contribution");
}

export function normalizeWorkspaceOperationPath(path: string): WorkspacePath {
  try {
    const normalized = normalizeWorkspacePath(path);
    if (!normalized || /[\u0000-\u001f\u007f]/u.test(normalized)) throw new Error("invalid path");
    return normalized;
  } catch {
    throw new WorkspaceWebIntegrationError("LOCAL_OPERATION_FAILED", "Workspace Path is invalid");
  }
}
