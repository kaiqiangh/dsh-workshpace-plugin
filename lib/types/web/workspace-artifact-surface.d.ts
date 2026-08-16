import { type ReactNode } from "react";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { WorkspaceDeliverable } from "../domain/deliverable.ts";
import type { PreviewDescriptor } from "../domain/preview.ts";
import { type WorkspaceDownloadRuntime } from "./workspace-deliverables.ts";
import { type WorkspacePrimitiveSet } from "./workspace-preview-adapters.ts";
import type { WorkspaceArtifactPreview } from "../host/workspace-artifacts.ts";
export declare const WORKSPACE_ARTIFACT_OVERLAY_SLOT: "shell.overlay";
export declare const WORKSPACE_ARTIFACT_SLOT_NAME: "shell.overlay";
export declare const WORKSPACE_ARTIFACT_ENTRY_KEY: "dsh-workspace-artifacts";
export interface WorkspaceArtifactRemote {
    readonly artifactMetadata: () => Promise<RemoteResult<readonly WorkspaceDeliverable[]>>;
    readonly previewArtifact: (id: string) => Promise<RemoteResult<WorkspaceArtifactPreview>>;
}
export interface WorkspaceArtifactSurfaceOptions {
    readonly runtime?: WorkspaceDownloadRuntime;
    readonly resourcePath?: string;
    readonly refreshMs?: number;
    readonly resolveRemote?: (sessionId: string | undefined) => WorkspaceArtifactRemote | undefined;
}
export type WorkspaceArtifactCategory = "documents" | "data" | "images" | "other";
/** Deterministic PRD-style grouping by media type (documents / data / images / other). */
export declare function workspaceArtifactCategory(mediaType: string): WorkspaceArtifactCategory;
/** Convert a path-free Host preview into the existing bounded renderer contract. */
export declare function workspaceArtifactPreviewDescriptor(artifact: WorkspaceDeliverable, preview: WorkspaceArtifactPreview): PreviewDescriptor;
/** Build one additive, keyboard-operable artifact list/detail surface. */
export declare function createWorkspaceArtifactSurfaceComponent(remote: WorkspaceArtifactRemote | undefined, primitives: WorkspacePrimitiveSet, options?: WorkspaceArtifactSurfaceOptions): (props: Record<string, unknown>) => ReactNode;
export declare function workspaceArtifactResourceUrl(artifact: WorkspaceDeliverable): string | undefined;
