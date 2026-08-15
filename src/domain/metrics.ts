export const metricNames = [
  "workspace-opened",
  "preview-opened",
  "artifact-opened",
  "working-set-sent",
  "capability-degraded",
] as const;

export type LocalMetricName = (typeof metricNames)[number];

export interface LocalMetricSnapshot {
  readonly sessionId: string;
  readonly counts: Readonly<Record<LocalMetricName, number>>;
}

export class LocalMetricError extends Error {
  readonly code = "INVALID_METRIC";

  constructor(message: string) {
    super(message);
    this.name = "LocalMetricError";
  }
}

function isMetricName(value: string): value is LocalMetricName {
  return metricNames.includes(value as LocalMetricName);
}

function emptyCounts(): Record<LocalMetricName, number> {
  return Object.fromEntries(metricNames.map((name) => [name, 0])) as Record<LocalMetricName, number>;
}

export function createLocalMetrics(sessionId: string) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw new LocalMetricError("A Harness Session id is required");
  }

  let counts = emptyCounts();
  return {
    record(name: string): void {
      if (!isMetricName(name)) throw new LocalMetricError(`Unknown Workspace metric: ${name}`);
      counts[name] += 1;
    },
    snapshot(): LocalMetricSnapshot {
      return { sessionId, counts: { ...counts } };
    },
    reset(): void {
      counts = emptyCounts();
    },
  };
}
