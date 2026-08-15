import { normalizeWorkspacePath } from "./workspace.ts";

const mib = 1024 * 1024;
const mandatoryExcludes = [".git/**", "node_modules/**", ".venv/**", "dist/**", "build/**", "__pycache__/**", ".cache/**"] as const;

export interface WorkspaceConfig {
  readonly enabled: boolean;
  readonly root: string;
  readonly files: { readonly showHidden: boolean; readonly exclude: readonly string[] };
  readonly preview: {
    readonly maxTextBytes: number;
    readonly maxJsonBytes: number;
    readonly maxCsvBytes: number;
    readonly maxCsvRows: number;
    readonly maxImageBytes: number;
    readonly maxPdfBytes: number;
  };
  readonly git: { readonly enabled: boolean };
  readonly activity: {
    readonly trackReads: boolean;
    readonly trackWrites: boolean;
    readonly trackShellChanges: boolean;
    readonly maxTimelineEvents: number;
    readonly coalesceWindowMs: number;
  };
  readonly workingSet: { readonly maxFiles: number };
}

export interface WorkspaceConfigInput {
  readonly enabled?: unknown;
  readonly root?: unknown;
  readonly files?: { readonly showHidden?: unknown; readonly exclude?: unknown };
  readonly preview?: Partial<Record<keyof WorkspaceConfig["preview"], unknown>>;
  readonly git?: { readonly enabled?: unknown };
  readonly activity?: Partial<Record<keyof WorkspaceConfig["activity"], unknown>>;
  readonly workingSet?: { readonly maxFiles?: unknown };
}

export interface ConfigResolution {
  readonly config: WorkspaceConfig;
  readonly warnings: readonly string[];
}

export type CapabilityStatus = "ready" | "unsupported";

export interface WorkspaceCapabilities {
  readonly core: "ready";
  readonly git: CapabilityStatus;
  readonly preview: CapabilityStatus;
}

const defaults: WorkspaceConfig = {
  enabled: true,
  root: ".",
  files: { showHidden: false, exclude: mandatoryExcludes },
  preview: {
    maxTextBytes: 2 * mib,
    maxJsonBytes: 5 * mib,
    maxCsvBytes: 10 * mib,
    maxCsvRows: 1_000,
    maxImageBytes: 20 * mib,
    maxPdfBytes: 50 * mib,
  },
  git: { enabled: true },
  activity: { trackReads: true, trackWrites: true, trackShellChanges: true, maxTimelineEvents: 500, coalesceWindowMs: 1_000 },
  workingSet: { maxFiles: 20 },
};

const ceilings = {
  maxTextBytes: 8 * mib,
  maxJsonBytes: 16 * mib,
  maxCsvBytes: 32 * mib,
  maxCsvRows: 10_000,
  maxImageBytes: 64 * mib,
  maxPdfBytes: 128 * mib,
  maxTimelineEvents: 5_000,
  coalesceWindowMs: 10_000,
  maxFiles: 100,
} as const;

function validObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean, field: string, warnings: string[]): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  warnings.push(`${field}: defaulted`);
  return fallback;
}

function boundedInt(value: unknown, fallback: number, ceiling: number, field: string, warnings: string[]): number {
  if (value === undefined) return fallback;
  if (Number.isSafeInteger(value) && value > 0 && value <= ceiling) return value;
  warnings.push(`${field}: defaulted`);
  return fallback;
}

function root(value: unknown, fallback: string, warnings: string[]): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    warnings.push("root: defaulted");
    return fallback;
  }
  try {
    const normalized = normalizeWorkspacePath(value);
    return normalized || ".";
  } catch {
    warnings.push("root: defaulted");
    return fallback;
  }
}

function excludes(value: unknown, fallback: readonly string[], warnings: string[]): readonly string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim() || item.startsWith("/") || item.includes(".."))) {
    warnings.push("files.exclude: defaulted");
    return fallback;
  }
  return [...new Set([...mandatoryExcludes, ...value])];
}

function section(input: WorkspaceConfigInput | undefined, key: string): Record<string, unknown> {
  const value = input?.[key as keyof WorkspaceConfigInput];
  return validObject(value) ? value : {};
}

export function resolveWorkspaceConfig(file?: WorkspaceConfigInput, hostOverride?: WorkspaceConfigInput): ConfigResolution {
  const warnings: string[] = [];
  const input = { ...file, ...hostOverride };
  const fileSection = section(file, "files");
  const hostSection = section(hostOverride, "files");
  const preview = { ...section(file, "preview"), ...section(hostOverride, "preview") };
  const activity = { ...section(file, "activity"), ...section(hostOverride, "activity") };
  const git = { ...section(file, "git"), ...section(hostOverride, "git") };
  const workingSet = { ...section(file, "workingSet"), ...section(hostOverride, "workingSet") };
  const fileExcludes = hostOverride?.files?.exclude === undefined ? fileSection.exclude : hostSection.exclude;
  return {
    config: {
      enabled: bool(input.enabled, defaults.enabled, "enabled", warnings),
      root: root(input.root, defaults.root, warnings),
      files: {
        showHidden: bool(hostOverride?.files?.showHidden ?? fileSection.showHidden, defaults.files.showHidden, "files.showHidden", warnings),
        exclude: excludes(fileExcludes, defaults.files.exclude, warnings),
      },
      preview: {
        maxTextBytes: boundedInt(preview.maxTextBytes, defaults.preview.maxTextBytes, ceilings.maxTextBytes, "preview.maxTextBytes", warnings),
        maxJsonBytes: boundedInt(preview.maxJsonBytes, defaults.preview.maxJsonBytes, ceilings.maxJsonBytes, "preview.maxJsonBytes", warnings),
        maxCsvBytes: boundedInt(preview.maxCsvBytes, defaults.preview.maxCsvBytes, ceilings.maxCsvBytes, "preview.maxCsvBytes", warnings),
        maxCsvRows: boundedInt(preview.maxCsvRows, defaults.preview.maxCsvRows, ceilings.maxCsvRows, "preview.maxCsvRows", warnings),
        maxImageBytes: boundedInt(preview.maxImageBytes, defaults.preview.maxImageBytes, ceilings.maxImageBytes, "preview.maxImageBytes", warnings),
        maxPdfBytes: boundedInt(preview.maxPdfBytes, defaults.preview.maxPdfBytes, ceilings.maxPdfBytes, "preview.maxPdfBytes", warnings),
      },
      git: { enabled: bool(git.enabled, defaults.git.enabled, "git.enabled", warnings) },
      activity: {
        trackReads: bool(activity.trackReads, defaults.activity.trackReads, "activity.trackReads", warnings),
        trackWrites: bool(activity.trackWrites, defaults.activity.trackWrites, "activity.trackWrites", warnings),
        trackShellChanges: bool(activity.trackShellChanges, defaults.activity.trackShellChanges, "activity.trackShellChanges", warnings),
        maxTimelineEvents: boundedInt(activity.maxTimelineEvents, defaults.activity.maxTimelineEvents, ceilings.maxTimelineEvents, "activity.maxTimelineEvents", warnings),
        coalesceWindowMs: boundedInt(activity.coalesceWindowMs, defaults.activity.coalesceWindowMs, ceilings.coalesceWindowMs, "activity.coalesceWindowMs", warnings),
      },
      workingSet: { maxFiles: boundedInt(workingSet.maxFiles, defaults.workingSet.maxFiles, ceilings.maxFiles, "workingSet.maxFiles", warnings) },
    },
    warnings,
  };
}

export function reportWorkspaceCapabilities(gitAvailable: boolean, previewAvailable: boolean): WorkspaceCapabilities {
  return { core: "ready", git: gitAvailable ? "ready" : "unsupported", preview: previewAvailable ? "ready" : "unsupported" };
}
