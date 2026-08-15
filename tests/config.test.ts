import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseWorkspaceConfigText, readWorkspaceConfigFile, reportWorkspaceCapabilities, resolveWorkspaceConfig, startConfiguredWorkspace } from "../src/domain/config.ts";

test("resolves safe defaults and appends mandatory excludes", () => {
  const { config, warnings } = resolveWorkspaceConfig({ files: { exclude: ["reports/**"] } });

  assert.equal(warnings.length, 0);
  assert.equal(config.preview.maxTextBytes, 2 * 1024 * 1024);
  assert.equal(config.workingSet.maxFiles, 20);
  assert.equal(config.files.exclude.includes(".git/**"), true);
  assert.equal(config.files.exclude.includes("reports/**"), true);
});

test("applies host overrides and defaults invalid fields", () => {
  const result = resolveWorkspaceConfig(
    { preview: { maxTextBytes: 4 * 1024 * 1024 }, files: { showHidden: true } },
    { preview: { maxTextBytes: 99 * 1024 * 1024 }, workingSet: { maxFiles: 40 } },
  );

  assert.equal(result.config.preview.maxTextBytes, 4 * 1024 * 1024);
  assert.equal(result.config.workingSet.maxFiles, 40);
  assert.equal(result.config.files.showHidden, true);
  assert.deepEqual(result.warnings, ["preview.maxTextBytes: defaulted"]);
});

test("rejects unsafe roots and excludes without taking down the core", () => {
  const result = resolveWorkspaceConfig({ root: "../../private", files: { exclude: ["C:outside/**"] } });

  assert.equal(result.config.root, ".");
  assert.equal(result.config.files.exclude.includes(".git/**"), true);
  assert.equal(result.warnings.includes("root: defaulted"), true);
  assert.equal(result.warnings.includes("files.exclude: defaulted"), true);
});

test("rejects Windows root-relative and NUL excludes", () => {
  const result = resolveWorkspaceConfig({ files: { exclude: ["\\\\outside/**"] } });
  const nul = resolveWorkspaceConfig({ files: { exclude: ["safe\0path/**"] } });

  assert.equal(result.warnings.includes("files.exclude: defaulted"), true);
  assert.equal(nul.warnings.includes("files.exclude: defaulted"), true);
});

test("warns on malformed sections and parses the supported YAML subset", () => {
  const parsed = parseWorkspaceConfigText("preview:\n  maxTextBytes: 4194304\nfiles:\n  exclude:\n    - reports/**\n");
  const result = resolveWorkspaceConfig({ ...parsed, activity: "bad" } as never);

  assert.equal(result.config.preview.maxTextBytes, 4 * 1024 * 1024);
  assert.equal(result.config.files.exclude.includes("reports/**"), true);
  assert.equal(result.warnings.includes("activity: defaulted"), true);
});

test("accepts documented inline YAML collections", () => {
  const parsed = parseWorkspaceConfigText('files: { exclude: ["reports/**"] }\n');
  const result = resolveWorkspaceConfig(parsed);

  assert.equal(result.config.files.exclude.includes("reports/**"), true);
  assert.deepEqual(result.warnings, []);
});

test("preserves hash characters inside quoted YAML values", () => {
  const parsed = parseWorkspaceConfigText('root: "dir # name" # comment\n');

  assert.deepEqual(parsed, { root: "dir # name" });
});

test("rejects excessively nested YAML collections", () => {
  assert.throws(() => parseWorkspaceConfigText(`files: { exclude: ${"[".repeat(70)}safe${"]".repeat(70)} }`), /nesting is too deep/);
});

test("warns when config contains unknown fields", () => {
  const result = resolveWorkspaceConfig({ evil: true } as never);

  assert.equal(result.warnings.includes("config.evil: ignored"), true);
});

test("keeps valid fields when a later YAML line is malformed", () => {
  const parsed = parseWorkspaceConfigText("preview:\n  maxTextBytes: 4194304\n- malformed\n");
  const result = resolveWorkspaceConfig(parsed);

  assert.equal(result.config.preview.maxTextBytes, 4 * 1024 * 1024);
  assert.equal(result.warnings.includes("config: defaulted"), true);
});

test("discovers bounded config from .dsh/workspace.yaml", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-config-"));
  try {
    await mkdir(join(root, ".dsh"));
    await writeFile(join(root, ".dsh", "workspace.yaml"), "preview:\n  maxTextBytes: 4194304\n");

    const result = await readWorkspaceConfigFile(root);
    assert.deepEqual(result, { preview: { maxTextBytes: 4194304 } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("starts the real Workspace lifecycle with resolved config", async () => {
  const result = await startConfiguredWorkspace({
    sessionId: "session-1",
    processCwd: process.cwd(),
    fileConfig: { root: "." },
  });

  assert.equal(result.workspace.identity.sessionId, "session-1");
  assert.equal(result.config.root, ".");
  assert.deepEqual(result.capabilities, { core: "ready", git: "unsupported", preview: "unsupported" });
});

test("falls back when a configured root is missing", async () => {
  const result = await startConfiguredWorkspace({
    sessionId: "session-missing-root",
    processCwd: process.cwd(),
    fileConfig: { root: "does-not-exist" },
  });

  assert.equal(result.workspace.identity.sessionId, "session-missing-root");
  assert.equal(result.workspace.baseline.source, "unknown");
  assert.equal(result.config.root, ".");
  assert.equal(result.warnings.includes("root: defaulted"), true);
});

test("falls back when a configured root symlink escapes the process root", async () => {
  const processRoot = await mkdtemp(join(tmpdir(), "dsh-root-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "dsh-outside-"));
  try {
    await symlink(outsideRoot, join(processRoot, "link"));

    const result = await startConfiguredWorkspace({
      sessionId: "session-symlink-root",
      processCwd: processRoot,
      fileConfig: { root: "link" },
    });

    assert.equal(result.config.root, ".");
    assert.equal(result.warnings.includes("root: defaulted"), true);
  } finally {
    await rm(processRoot, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("reports probed optional capabilities without changing the core lifecycle", async () => {
  const result = await startConfiguredWorkspace({
    sessionId: "session-2",
    processCwd: process.cwd(),
    fileConfig: { git: { enabled: true } },
    gitAvailable: true,
    previewAvailable: true,
  });

  assert.deepEqual(result.capabilities, { core: "ready", git: "ready", preview: "ready" });
});

test("reports a disabled Workspace without disabling optional capability reporting", async () => {
  const result = await startConfiguredWorkspace({
    sessionId: "session-disabled",
    processCwd: process.cwd(),
    fileConfig: { enabled: false },
    gitAvailable: true,
    previewAvailable: true,
  });

  assert.deepEqual(result.capabilities, { core: "unsupported", git: "ready", preview: "ready" });
});

test("reports optional capability degradation locally", () => {
  assert.deepEqual(reportWorkspaceCapabilities(false, true), { core: "ready", git: "unsupported", preview: "ready" });
});
