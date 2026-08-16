import { type ReactNode } from "react";
/** A session-scoped Workspace surface component (Artifacts / Memory / Changes). */
export type WorkspaceSurfaceComponent = (props: Record<string, unknown>) => ReactNode;
export declare function installWorkspaceStyles(): () => void;
