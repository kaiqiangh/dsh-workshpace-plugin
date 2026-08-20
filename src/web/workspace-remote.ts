import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import { t, type WorkspaceMessageKey } from "./workspace-i18n.ts";

/** Unwrap a RemoteResult, throwing a normalized `CODE: message` error on failure. */
export function unwrapRemote<T>(result: RemoteResult<T>): T {
  if (result.ok) return result.value;
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

/** Best-effort extraction of the leading error code from a thrown message. */
export function remoteCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code = error.message.split(":")[0]?.trim();
  return code && code.length > 0 && code.length <= 64 ? code : undefined;
}

const remoteMessages: Record<string, WorkspaceMessageKey> = {
  GIT_UNAVAILABLE: "error.gitUnavailable",
  NOT_A_GIT_REPOSITORY: "error.notGitRepository",
  GIT_TIMEOUT: "error.gitTimeout",
  GIT_OUTPUT_TOO_LARGE: "error.gitOutputTooLarge",
  PATH_OUTSIDE_WORKSPACE: "error.pathOutsideWorkspace",
  PROVIDER_UNAVAILABLE: "error.providerUnavailable",
  PROJECT_UNAVAILABLE: "error.projectUnavailable",
  RESOURCE_STALE: "error.resourceStale",
  RESOURCE_EXPIRED: "error.resourceExpired",
  FILE_TOO_LARGE: "error.fileTooLarge",
  SYMLINK_ESCAPE: "error.symlinkEscape",
};

/** Map a remote error code to a friendly, non-technical message. */
export function friendlyRemoteMessage(code: string | undefined, fallback: string): string {
  if (code) {
    const key = remoteMessages[code];
    if (key) return t(key);
  }
  return fallback;
}

/** Friendly user-facing message for a thrown remote error. */
export function remoteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return friendlyRemoteMessage(remoteCode(error), error.message);
  return fallback;
}
