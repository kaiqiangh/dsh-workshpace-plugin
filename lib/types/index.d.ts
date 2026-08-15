import { TypertRemoteService, type TypertContext } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentId, PinnedContextRemoteSnapshot } from "./types.ts";
export { createPinnedContext, pinContextPath, setContextCapacity, updateContextPath } from "./domain/context.ts";
export { registerPinnedContextCarrier } from "./domain/context-carrier.ts";
declare module "@deepseek-ai/dsh-typert-protocol" {
    interface TypertContextMap {
        agent: TypertContext<AgentId>;
    }
}
export declare class WorkspaceService extends TypertRemoteService {
    private snapshot;
    constructor(ctx: Context);
    summary(agent: AgentId): {
        readonly ready: boolean;
        readonly agent: AgentId;
    };
    focus(): {
        readonly focused: boolean;
    };
    contextSnapshot(): PinnedContextRemoteSnapshot;
    replaceContext(snapshot: PinnedContextRemoteSnapshot): PinnedContextRemoteSnapshot;
}
export declare const name = "dsh-workspace-plugin";
export declare function apply(ctx: Context): void;
