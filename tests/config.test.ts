import test from "node:test";
import assert from "node:assert/strict";

import { reportWorkspaceCapabilities, resolveWorkspaceConfig } from "../src/domain/config.ts";

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

  assert.equal(result.config.preview.maxTextBytes, 2 * 1024 * 1024);
  assert.equal(result.config.workingSet.maxFiles, 40);
  assert.equal(result.config.files.showHidden, true);
  assert.deepEqual(result.warnings, ["preview.maxTextBytes: defaulted"]);
});

test("rejects unsafe roots and excludes without taking down the core", () => {
  const result = resolveWorkspaceConfig({ root: "../../private", files: { exclude: ["/etc/**"] } });

  assert.equal(result.config.root, ".");
  assert.equal(result.config.files.exclude.includes(".git/**"), true);
  assert.equal(result.warnings.includes("root: defaulted"), true);
  assert.equal(result.warnings.includes("files.exclude: defaulted"), true);
});

test("reports optional capability degradation locally", () => {
  assert.deepEqual(reportWorkspaceCapabilities(false, true), { core: "ready", git: "unsupported", preview: "ready" });
});
