export type WorkspacePath = string & {
    readonly __workspacePath: unique symbol;
};
export declare class WorkspacePathError extends Error {
    constructor(message: string);
}
export declare function normalizeWorkspacePath(input: string): WorkspacePath;
