import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeWorkspacePath, startWorkspace, type BaselineObservation, type WorkspaceSnapshot } from "./workspace.ts";

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

function bool(value: unknown, fallback: boolean, field: string, warnings: string[], warn = true): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (warn) warnings.push(`${field}: defaulted`);
  return fallback;
}

function boundedInt(value: unknown, fallback: number, ceiling: number, field: string, warnings: string[], warn = true): number {
  if (value === undefined) return fallback;
  if (Number.isSafeInteger(value) && value > 0 && value <= ceiling) return value;
  if (warn) warnings.push(`${field}: defaulted`);
  return fallback;
}

function root(value: unknown, fallback: string, warnings: string[], warn = true): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    if (warn) warnings.push("root: defaulted");
    return fallback;
  }
  try {
    const normalized = normalizeWorkspacePath(value);
    return normalized || ".";
  } catch {
    if (warn) warnings.push("root: defaulted");
    return fallback;
  }
}

function excludes(value: unknown, fallback: readonly string[], warnings: string[], warn = true): readonly string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim() || item.startsWith("/") || /^[A-Za-z]:[\\/]/.test(item) || /^(?:\\\\|\/\/)/.test(item) || item.includes(".."))) {
    if (warn) warnings.push("files.exclude: defaulted");
    return fallback;
  }
  return [...new Set([...mandatoryExcludes, ...value])];
}

function section(input: WorkspaceConfigInput | undefined, key: string, warnings: string[], label: string): Record<string, unknown> {
  const value = input?.[key as keyof WorkspaceConfigInput];
  if (value === undefined) return {};
  if (validObject(value)) return value;
  warnings.push(`${label}: defaulted`);
  return {};
}

function layeredBool(fileValue: unknown, hostValue: unknown, fallback: boolean, field: string, warnings: string[]): boolean {
  const file = bool(fileValue, fallback, field, warnings);
  return hostValue === undefined ? file : bool(hostValue, file, field, warnings);
}

function layeredInt(fileValue: unknown, hostValue: unknown, fallback: number, ceiling: number, field: string, warnings: string[]): number {
  const file = boundedInt(fileValue, fallback, ceiling, field, warnings);
  return hostValue === undefined ? file : boundedInt(hostValue, file, ceiling, field, warnings);
}

function layeredRoot(fileValue: unknown, hostValue: unknown, fallback: string, warnings: string[]): string {
  const file = root(fileValue, fallback, warnings);
  return hostValue === undefined ? file : root(hostValue, file, warnings);
}

function layeredExcludes(fileValue: unknown, hostValue: unknown, fallback: readonly string[], warnings: string[]): readonly string[] {
  const file = excludes(fileValue, fallback, warnings);
  return hostValue === undefined ? file : excludes(hostValue, file, warnings);
}

export function resolveWorkspaceConfig(file?: WorkspaceConfigInput, hostOverride?: WorkspaceConfigInput): ConfigResolution {
  const warnings: string[] = [];
  const fileSection = section(file, "files", warnings, "files");
  const hostSection = section(hostOverride, "files", warnings, "files");
  const filePreview = section(file, "preview", warnings, "preview");
  const hostPreview = section(hostOverride, "preview", warnings, "preview");
  const fileActivity = section(file, "activity", warnings, "activity");
  const hostActivity = section(hostOverride, "activity", warnings, "activity");
  const fileGit = section(file, "git", warnings, "git");
  const hostGit = section(hostOverride, "git", warnings, "git");
  const fileWorkingSet = section(file, "workingSet", warnings, "workingSet");
  const hostWorkingSet = section(hostOverride, "workingSet", warnings, "workingSet");
  return {
    config: {
      enabled: layeredBool(file?.enabled, hostOverride?.enabled, defaults.enabled, "enabled", warnings),
      root: layeredRoot(file?.root, hostOverride?.root, defaults.root, warnings),
      files: {
        showHidden: layeredBool(fileSection.showHidden, hostSection.showHidden, defaults.files.showHidden, "files.showHidden", warnings),
        exclude: layeredExcludes(fileSection.exclude, hostSection.exclude, defaults.files.exclude, warnings),
      },
      preview: {
        maxTextBytes: layeredInt(filePreview.maxTextBytes, hostPreview.maxTextBytes, defaults.preview.maxTextBytes, ceilings.maxTextBytes, "preview.maxTextBytes", warnings),
        maxJsonBytes: layeredInt(filePreview.maxJsonBytes, hostPreview.maxJsonBytes, defaults.preview.maxJsonBytes, ceilings.maxJsonBytes, "preview.maxJsonBytes", warnings),
        maxCsvBytes: layeredInt(filePreview.maxCsvBytes, hostPreview.maxCsvBytes, defaults.preview.maxCsvBytes, ceilings.maxCsvBytes, "preview.maxCsvBytes", warnings),
        maxCsvRows: layeredInt(filePreview.maxCsvRows, hostPreview.maxCsvRows, defaults.preview.maxCsvRows, ceilings.maxCsvRows, "preview.maxCsvRows", warnings),
        maxImageBytes: layeredInt(filePreview.maxImageBytes, hostPreview.maxImageBytes, defaults.preview.maxImageBytes, ceilings.maxImageBytes, "preview.maxImageBytes", warnings),
        maxPdfBytes: layeredInt(filePreview.maxPdfBytes, hostPreview.maxPdfBytes, defaults.preview.maxPdfBytes, ceilings.maxPdfBytes, "preview.maxPdfBytes", warnings),
      },
      git: { enabled: layeredBool(fileGit.enabled, hostGit.enabled, defaults.git.enabled, "git.enabled", warnings) },
      activity: {
        trackReads: layeredBool(fileActivity.trackReads, hostActivity.trackReads, defaults.activity.trackReads, "activity.trackReads", warnings),
        trackWrites: layeredBool(fileActivity.trackWrites, hostActivity.trackWrites, defaults.activity.trackWrites, "activity.trackWrites", warnings),
        trackShellChanges: layeredBool(fileActivity.trackShellChanges, hostActivity.trackShellChanges, defaults.activity.trackShellChanges, "activity.trackShellChanges", warnings),
        maxTimelineEvents: layeredInt(fileActivity.maxTimelineEvents, hostActivity.maxTimelineEvents, defaults.activity.maxTimelineEvents, ceilings.maxTimelineEvents, "activity.maxTimelineEvents", warnings),
        coalesceWindowMs: layeredInt(fileActivity.coalesceWindowMs, hostActivity.coalesceWindowMs, defaults.activity.coalesceWindowMs, ceilings.coalesceWindowMs, "activity.coalesceWindowMs", warnings),
      },
      workingSet: { maxFiles: layeredInt(fileWorkingSet.maxFiles, hostWorkingSet.maxFiles, defaults.workingSet.maxFiles, ceilings.maxFiles, "workingSet.maxFiles", warnings) },
    },
    warnings,
  };
}

function scalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

export function parseWorkspaceConfigText(text: string): WorkspaceConfigInput {
  if (typeof text !== "string") throw new TypeError("Workspace config must be text");
  const rootValue: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> | unknown[] }> = [{ indent: -1, value: rootValue }];
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+#.*$/, "")).filter((line) => line.trim());
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (/^\s*\t/.test(line)) throw new TypeError("Workspace config cannot use tabs");
    while (stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1)!.value;
    const body = line.trim();
    if (body.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new TypeError("Workspace config list is misplaced");
      parent.push(scalar(body.slice(2)));
      continue;
    }
    const separator = body.indexOf(":");
    if (separator < 1 || !validObject(parent)) throw new TypeError("Workspace config mapping is invalid");
    const key = body.slice(0, separator).trim();
    const value = body.slice(separator + 1).trim();
    if (value) {
      parent[key] = scalar(value);
      continue;
    }
    const next = lines[lineIndex + 1]?.trim();
    const child: Record<string, unknown> | unknown[] = next?.startsWith("- ") ? [] : {};
    parent[key] = child;
    stack.push({ indent, value: child });
  }
  return rootValue as WorkspaceConfigInput;
}

export async function readWorkspaceConfigFile(processCwd: string): Promise<WorkspaceConfigInput | undefined> {
  try {
    return parseWorkspaceConfigText(await readFile(join(processCwd, ".dsh", "workspace.yaml"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function startConfiguredWorkspace(args: {
  readonly sessionId: string;
  readonly processCwd: string;
  readonly fileConfig?: WorkspaceConfigInput;
  readonly hostOverride?: WorkspaceConfigInput;
  readonly baseline?: BaselineObservation;
  /** Host probes are optional; unknown optional services stay conservatively unsupported. */
  readonly gitAvailable?: boolean;
  readonly previewAvailable?: boolean;
}): Promise<{
  readonly workspace: WorkspaceSnapshot;
  readonly config: WorkspaceConfig;
  readonly warnings: readonly string[];
  readonly capabilities: WorkspaceCapabilities;
}> {
  let fileConfig = args.fileConfig;
  const warnings: string[] = [];
  if (fileConfig === undefined) {
    try {
      fileConfig = await readWorkspaceConfigFile(args.processCwd);
    } catch {
      warnings.push("config: defaulted");
    }
  }
  const resolved = resolveWorkspaceConfig(fileConfig, args.hostOverride);
  return {
    config: resolved.config,
    warnings: [...warnings, ...resolved.warnings],
    capabilities: reportWorkspaceCapabilities(
      resolved.config.git.enabled && args.gitAvailable === true,
      args.previewAvailable === true,
    ),
    workspace: startWorkspace({ sessionId: args.sessionId, processCwd: args.processCwd, configuredRoot: resolved.config.root, baseline: args.baseline }),
  };
}

export function reportWorkspaceCapabilities(gitAvailable: boolean, previewAvailable: boolean): WorkspaceCapabilities {
  return { core: "ready", git: gitAvailable ? "ready" : "unsupported", preview: previewAvailable ? "ready" : "unsupported" };
}
