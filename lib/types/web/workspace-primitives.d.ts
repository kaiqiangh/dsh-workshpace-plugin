import { type ReactNode } from "react";
/**
 * Shared Workspace surface UI atoms. Every element reuses the scoped
 * `[data-dsh-workspace]` vocabulary from workspace-styles.ts so the three
 * surfaces (Artifacts / Memory / Changes) stay visually consistent without
 * leaking into the rest of the Harness UI.
 */
export interface WorkspaceSurfaceHeaderParts {
    readonly title: string;
    readonly count?: ReactNode;
    readonly actions?: ReactNode;
}
/** A notice callout with an informational/warning/error tone. */
export declare function workspaceNotice(tone: "info" | "warning" | "error", children: ReactNode, key?: string): ReactNode;
/** A dashed empty-state callout with guidance. */
export declare function workspaceEmptyState(children: ReactNode, key?: string): ReactNode;
/** A pill count badge. `text` is the fully-formed label (e.g. "2 changes"). */
export declare function workspaceCountBadge(text: string, variant?: "accent" | "neutral", key?: string): ReactNode;
/** Surface header row: title + optional count badge + optional action buttons. */
export declare function workspaceSurfaceHeader(parts: WorkspaceSurfaceHeaderParts): ReactNode;
/** An uppercase status chip; `status` drives the CSS color (success/warning/danger/neutral). */
export declare function workspaceStatusChip(label: string, status: string, key?: string): ReactNode;
/** A filter chip button with pressed state. */
export declare function workspaceFilterChip(label: string, active: boolean, onClick: () => void, key?: string): ReactNode;
/** A segmented control row (e.g. Memory scope switcher). */
export declare function workspaceSegment(label: string, children: ReactNode, key?: string): ReactNode;
/** A toolbar row inside a surface toolbar. */
export declare function workspaceToolbarRow(children: ReactNode, key?: string): ReactNode;
