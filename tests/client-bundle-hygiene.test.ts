import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Regression guard for the "client-modules loader" failure: the browser client
 * bundle (lib/client.js) must never require Node built-ins. The dsh-web-ui
 * loader's module table only materializes platform seed words + registered
 * factories; a leaked `require("node:child_process")` (build-time externals
 * drift — e.g. a web surface value-importing a host constant that drags in a
 * child_process-based module) fails plugin load at runtime.
 */
test("built client bundle contains no Node built-in requires (web loader compat)", () => {
  const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const forbidden = /require\(\s*["']node:[a-z_]+["']\)|require\(\s*["'](?:child_process|fs|path|util|crypto|os|events|stream|net|http|https|zlib|url|querystring)["']\)/gu;
  const hits = [...source.matchAll(forbidden)].map((match) => match[0]);
  assert.deepEqual(
    hits,
    [],
    `client bundle must not require Node built-ins (found: ${hits.join(", ") || "none"})`,
  );
});
