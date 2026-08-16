import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";

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

/** Map a remote error code to a friendly, non-technical message. */
export function friendlyRemoteMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "GIT_UNAVAILABLE":
      return "Git is not available for this workspace.";
    case "NOT_A_GIT_REPOSITORY":
      return "This workspace is not a git repository.";
    case "GIT_TIMEOUT":
      return "Git did not respond in time; try again.";
    case "GIT_OUTPUT_TOO_LARGE":
      return "The change is too large to show fully.";
    case "PATH_OUTSIDE_WORKSPACE":
      return "This change sits outside the Workspace and is blocked.";
    case "PROVIDER_UNAVAILABLE":
      return "The Workspace provider is unavailable right now.";
    case "PROJECT_UNAVAILABLE":
      return "This session is not bound to a Workspace.";
    case "RESOURCE_STALE":
      return "This item changed or expired; refresh to see the latest.";
    case "RESOURCE_EXPIRED":
      return "This item expired; refresh to reload it.";
    case "FILE_TOO_LARGE":
      return "This item is too large to preview.";
    case "SYMLINK_ESCAPE":
      return "This item points outside the Workspace and is blocked.";
    default:
      return fallback;
  }
}

/** Friendly user-facing message for a thrown remote error. */
export function remoteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return friendlyRemoteMessage(remoteCode(error), error.message);
  return fallback;
}
