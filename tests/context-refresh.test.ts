import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPinnedContext,
  hashPinnedContextContent,
  pinContextPath,
  setContextCapacity,
  updateContextPath,
} from "../src/domain/context.ts";
import {
  PinnedContextRefreshError,
  PinnedContextRefreshController,
  previewContextReader,
} from "../src/domain/context-refresh.ts";
import { PreviewPanelError, PreviewService } from "../src/domain/preview.ts";

const identity = { sessionId: "refresh-session", rootId: "root:refresh" };

function readyState(values: Record<string, string>, maxItemBytes = 10_000) {
  let state = createPinnedContext(identity, { maxItemBytes, maxTokens: 10_000, reservedOutputTokens: 10 });
  for (const path of Object.keys(values)) state = pinContextPath(state, path);
  state = setContextCapacity(state, 100_000);
  for (const [path, content] of Object.entries(values)) {
    state = updateContextPath(state, { path, status: "ready", content, loadedAt: 1 });
  }
  return state;
}

function fakeReader(values: Map<string, string>) {
  const reads: string[] = [];
  return {
    reads,
    async read(path: string, _maxBytes: number, signal?: AbortSignal) {
      signal?.throwIfAborted();
      reads.push(path);
      const content = values.get(path);
      if (content === undefined) throw new PreviewPanelError("FILE_NOT_FOUND", "File is unavailable");
      return { path: path as never, content, bytes: Buffer.byteLength(content), version: `v:${content}`, loadedAt: 2 };
    },
  };
}

test("coalesces activity and resume requests, skips unchanged content, and publishes only changes", async () => {
  const values = new Map([['a.ts', "a"], ["b.ts", "b"]]);
  const reader = fakeReader(values);
  const published: string[] = [];
  const controller = new PinnedContextRefreshController(readyState(Object.fromEntries(values)), reader, {
    publish: (state) => published.push(state.entries.map((entry) => entry.contentHash ?? entry.status).join(",")),
  });

  controller.request("activity");
  controller.request("resume");
  const unchanged = await controller.flushAtAssembly();
  assert.equal(unchanged.reason, "resume");
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.refreshedPaths, []);
  assert.equal(published.length, 0);

  values.set("a.ts", "changed");
  controller.request("activity");
  const changed = await controller.flushAtAssembly();
  assert.equal(changed.changed, true);
  assert.deepEqual(changed.refreshedPaths, ["a.ts"]);
  assert.equal(published.length, 1);
  assert.equal(controller.state.entries[0]?.contentHash, hashPinnedContextContent("changed"));
  await controller.flushAtAssembly();
  assert.equal(published.length, 1);
  controller.dispose();
});

test("keeps stale, oversized, and unreadable files typed and local", async () => {
  const state = readyState({ "stale.ts": "old", "large.ts": "old", "missing.ts": "old" }, 4);
  const reader = {
    async read(path: string) {
      if (path === "stale.ts") throw new PreviewPanelError("RESOURCE_STALE", "stale");
      if (path === "large.ts") throw new PreviewPanelError("FILE_TOO_LARGE", "large");
      throw new PreviewPanelError("FILE_NOT_FOUND", "missing");
    },
  };
  const controller = new PinnedContextRefreshController(state, reader);
  const result = await controller.refresh("assembly");
  assert.equal(result.changed, true);
  assert.deepEqual(controller.state.entries.map((entry) => [entry.path, entry.status, entry.omissionReason]), [
    ["stale.ts", "stale", "stale"],
    ["large.ts", "oversized", "oversized"],
    ["missing.ts", "unreadable", "unreadable"],
  ]);
  controller.dispose();
});

test("cancellation and disposal prevent a late reader result from publishing", async () => {
  let resolveRead: ((value: { path: string; content: string; bytes: number; version: string; loadedAt: number }) => void) | undefined;
  const reader = {
    read: async (path: string) => new Promise<{ path: string; content: string; bytes: number; version: string; loadedAt: number }>((resolve) => {
      resolveRead = resolve;
    }),
  };
  let publishes = 0;
  const controller = new PinnedContextRefreshController(readyState({ "a.ts": "old" }), reader, { publish: () => { publishes += 1; } });
  const pending = controller.refresh("activity");
  controller.dispose();
  resolveRead?.({ path: "a.ts", content: "late", bytes: 4, version: "late", loadedAt: 3 });
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.equal(publishes, 0);
  assert.throws(() => controller.request("assembly"), (error) => error instanceof PinnedContextRefreshError && error.code === "DISPOSED");
});

test("restores only the same Workspace identity and reads through PreviewService bounds", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-context-refresh-"));
  try {
    await writeFile(join(root, "a.ts"), "const a = 1;");
    const preview = new PreviewService(root, identity);
    const controller = new PinnedContextRefreshController(readyState({ "a.ts": "old" }), previewContextReader(preview));
    const result = await controller.refresh("resume");
    assert.equal(result.state.entries[0]?.content, "const a = 1;");
    const mismatched = createPinnedContext({ ...identity, rootId: "root:other" });
    assert.throws(() => controller.restore(mismatched), (error) => error instanceof PinnedContextRefreshError && error.code === "IDENTITY_MISMATCH");
    preview.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
