import test from "node:test";
import assert from "node:assert/strict";

import { parseWorkspaceConfigText, reportWorkspaceCapabilities, resolveWorkspaceConfig, startConfiguredWorkspace } from "../src/domain/config.ts";

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
  const result = resolveWorkspaceConfig({ root: "../../private", files: { exclude: ["C:\\\\outside\\\\**"] } });

  assert.equal(result.config.root, ".");
  assert.equal(result.config.files.exclude.includes(".git/**"), true);
  assert.equal(result.warnings.includes("root: defaulted"), true);
  assert.equal(result.warnings.includes("files.exclude: defaulted"), true);
});

test("warns on malformed sections and parses the supported YAML subset", () => {
  const parsed = parseWorkspaceConfigText("preview:\n  maxTextBytes: 4194304\nfiles:\n  exclude:\n    - reports/**\n");
  const result = resolveWorkspaceConfig({ ...parsed, activity: "bad" } as never);

  assert.equal(result.config.preview.maxTextBytes, 4 * 1024 * 1024);
  assert.equal(result.config.files.exclude.includes("reports/**"), true);
  assert.equal(result.warnings.includes("activity: defaulted"), true);
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

test("reports optional capability degradation locally", () => {
  assert.deepEqual(reportWorkspaceCapabilities(false, true), { core: "ready", git: "unsupported", preview: "ready" });
});
