export type WorkspacePath = string & { readonly __workspacePath: unique symbol };

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export function normalizeWorkspacePath(input: string): WorkspacePath {
  if (typeof input !== "string" || input.includes("\0")) {
    throw new WorkspacePathError("Workspace Path must be a valid string");
  }

  const logicalPath = input.replaceAll("\\", "/");
  if (logicalPath.startsWith("/") || /^[A-Za-z]:/.test(logicalPath)) {
    throw new WorkspacePathError("Workspace Path must be relative");
  }

  const segments = logicalPath.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new WorkspacePathError("Workspace Path cannot traverse its root");
  }

  return segments.filter((segment) => segment && segment !== ".").join("/") as WorkspacePath;
}
