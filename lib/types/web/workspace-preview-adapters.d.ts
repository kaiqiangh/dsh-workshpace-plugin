import type { PreviewDescriptor } from "../domain/preview.ts";
export interface WorkspacePrimitiveSet {
    readonly MarkdownText: (props: {
        readonly text: string;
        readonly streaming?: boolean;
    }) => unknown;
    readonly CodeBlock: (props: {
        readonly code: string;
        readonly lang?: string;
    }) => unknown;
    readonly JsonTree: (props: {
        readonly data: object | readonly unknown[];
        readonly label?: string;
        readonly copyable?: boolean;
        readonly expandTopLevel?: boolean;
    }) => unknown;
}
export interface WorkspacePreviewRenderOptions {
    readonly resourceUrl?: string;
    readonly downloadName?: string;
}
/** Remove remote image fetches before handing bounded Markdown to the Harness renderer. */
export declare function sanitizeWorkspaceMarkdown(text: string): string;
/** Render only bounded, already-authorized Host data through public UI primitives. */
export declare function createWorkspacePreviewRenderer(primitives: WorkspacePrimitiveSet, descriptor: PreviewDescriptor, options?: WorkspacePreviewRenderOptions): unknown;
