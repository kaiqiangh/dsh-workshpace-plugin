import { type ReactNode } from "react";
export declare const WORKSPACE_PANEL_OVERLAY_SLOT: "shell.overlay";
export declare const WORKSPACE_PANEL_ENTRY_KEY: "dsh-workspace-panel";
export type WorkspaceSurfaceComponent = (props: Record<string, unknown>) => ReactNode;
export interface WorkspacePanelOptions {
    readonly artifacts: WorkspaceSurfaceComponent;
    readonly memory: WorkspaceSurfaceComponent;
}
export declare function installWorkspacePanelStyles(): () => void;
export declare function createWorkspacePanelComponent(options: WorkspacePanelOptions): WorkspaceSurfaceComponent;
