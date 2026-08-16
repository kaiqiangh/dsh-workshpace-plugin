import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
/** Unwrap a RemoteResult, throwing a normalized `CODE: message` error on failure. */
export declare function unwrapRemote<T>(result: RemoteResult<T>): T;
/** Best-effort extraction of the leading error code from a thrown message. */
export declare function remoteCode(error: unknown): string | undefined;
/** Map a remote error code to a friendly, non-technical message. */
export declare function friendlyRemoteMessage(code: string | undefined, fallback: string): string;
/** Friendly user-facing message for a thrown remote error. */
export declare function remoteErrorMessage(error: unknown, fallback: string): string;
