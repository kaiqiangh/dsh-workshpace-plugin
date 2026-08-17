import { type ComponentType, type ExoticComponent } from "react";
import type { PreviewDescriptor } from "../domain/preview.ts";
type WorkspacePrimitive<Props extends object> = ComponentType<Props> | ExoticComponent<Props>;
export interface WorkspacePrimitiveSet {
    readonly MarkdownText: WorkspacePrimitive<{
        readonly text: string;
        readonly streaming?: boolean;
    }>;
    readonly CodeBlock: WorkspacePrimitive<{
        readonly code: string;
        readonly lang?: string;
    }>;
    readonly JsonTree: WorkspacePrimitive<{
        readonly data: object | readonly unknown[];
        readonly label?: string;
        readonly copyable?: boolean;
        readonly expandTopLevel?: boolean;
    }>;
}
export interface WorkspacePreviewRenderOptions {
    readonly resourcePath?: string;
    readonly downloadName?: string;
    readonly altText?: string;
}
/**
 * Remove remote Markdown image fetches before rendering, while preserving
 * relative images so the v0.6 renderer can resolve them to same-origin opaque
 * resource URLs. Relative srcs (`./x.png`, `../x.png`, `/x.png`, plain
 * filenames) pass through unchanged; absolute http(s)/data:/other-scheme srcs
 * and remote reference definitions are stripped to their alt text. The
 * renderer's `resolveImageSrc` hook then decides what actually renders.
 */
export declare function sanitizeWorkspaceMarkdown(text: string): string;
/** Render only bounded, already-authorized Host data through public UI primitives. */
export declare function createWorkspacePreviewRenderer(primitives: WorkspacePrimitiveSet, descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown;
export {};
