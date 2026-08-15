import type { WorkspaceIdentity } from "./workspace.ts";

const metricNames = [
  "workspace-opened",
  "preview-opened",
  "artifact-opened",
  "working-set-sent",
  "capability-degraded",
] as const;

export type LocalMetricName = (typeof metricNames)[number];

export interface LocalMetricSnapshot {
  readonly identity: WorkspaceIdentity;
  readonly counts: Readonly<Record<LocalMetricName, number>>;
}

export interface LocalMetricRecorder {
  record(name: unknown): void;
}

export class LocalMetricError extends Error {
  readonly code = "INVALID_METRIC";

  constructor(message: string) {
    super(message);
    this.name = "LocalMetricError";
  }
}

function isMetricName(value: unknown): value is LocalMetricName {
  return metricNames.includes(value as LocalMetricName);
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && !/[\\/\0]/.test(value);
}

function emptyCounts(): Record<LocalMetricName, number> {
  return Object.fromEntries(metricNames.map((name) => [name, 0])) as Record<LocalMetricName, number>;
}

export function createLocalMetrics(identity: WorkspaceIdentity): LocalMetricRecorder & {
  snapshot(): LocalMetricSnapshot;
  reset(): void;
} {
  if (!identity || typeof identity !== "object" || !isOpaqueId(identity.sessionId) || !/^root:[a-f0-9]{64}$/i.test(identity.rootId)) {
    throw new LocalMetricError("A Workspace identity is required");
  }

  const scopedIdentity: WorkspaceIdentity = { sessionId: identity.sessionId, rootId: identity.rootId };
  let counts = emptyCounts();
  return {
    record(name: unknown): void {
      if (!isMetricName(name)) throw new LocalMetricError(`Unknown Workspace metric: ${String(name)}`);
      counts[name] += 1;
    },
    snapshot(): LocalMetricSnapshot {
      return { identity: { ...scopedIdentity }, counts: { ...counts } };
    },
    reset(): void {
      counts = emptyCounts();
    },
  };
}
