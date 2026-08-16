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
/** Remove Markdown image fetches before handing bounded content to the Harness renderer. */
export declare function sanitizeWorkspaceMarkdown(text: string): string;
/** Render only bounded, already-authorized Host data through public UI primitives. */
export declare function createWorkspacePreviewRenderer(primitives: WorkspacePrimitiveSet, descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown;
export {};
