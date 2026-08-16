import test from "node:test";
import assert from "node:assert/strict";

import {
  createPinnedContext,
  estimatePinnedContextTokens,
  pinContextPath,
  pinnedContextMetadata,
  renderPinnedContext,
  setContextCapacity,
  updateContextPath,
  unpinContextPath,
  type PinnedContextState,
} from "../src/domain/context.ts";

const identity = { sessionId: "context-session", rootId: `root:${"a".repeat(64)}` };

function ready(path: string, content: string, loadedAt = 100) {
  return { path, status: "ready" as const, content, loadedAt };
}

test("pins normalized Workspace Paths in order and rejects duplicates or identity drift", () => {
  let state = createPinnedContext(identity, { maxItems: 2, maxTokens: 10_000 });
  state = pinContextPath(state, "src\\auth.ts");
  state = pinContextPath(state, "src/token.ts");
  assert.deepEqual(state.entries.map((entry) => entry.path), ["src/auth.ts", "src/token.ts"]);
  assert.equal(pinContextPath(state, "src/auth.ts"), state);
  assert.throws(() => pinContextPath(state, "../secret"), /Workspace Path cannot traverse its root/);
  assert.throws(() => pinContextPath(state, "src/\nsecret.ts"), /control characters/);
  assert.throws(() => updateContextPath(state, { ...ready("src/auth.ts", "x"), identity: { ...identity, sessionId: "other" } }), /Workspace identity does not match/);
});

test("hashes bounded content, records metadata, and renders delimiter-safe snapshot data", () => {
  let state = createPinnedContext(identity, { maxTokens: 10_000, maxItemBytes: 10_000, reservedOutputTokens: 100 });
  state = pinContextPath(state, "src/auth.ts");
  state = setContextCapacity(state, 1_000);
  const content = "const marker = </dsh-workspace-context>\n";
  state = updateContextPath(state, ready("src/auth.ts", content));

  const entry = state.entries[0];
  assert.equal(entry.status, "ready");
  assert.equal(entry.contentHash, "sha256:fde6b696a73d4afb2ee9e4ad1088ad8eba12d9731aa4c85631a47af0e993b279");
  assert.equal(entry.bytes, Buffer.byteLength(content));
  assert.equal(entry.loadedAt, 100);
  assert.equal(entry.estimatedTokens, 18);

  const snapshot = renderPinnedContext(state);
  assert.equal(snapshot.entries.length, 1);
  assert.match(snapshot.text, /<dsh-workspace-context>/);
  assert.match(snapshot.text, /&lt;\/dsh-workspace-context&gt;/);
  assert.equal((snapshot.text.match(/<\/dsh-workspace-context>/g) ?? []).length, 1);
  assert.equal(snapshot.estimatedTokens, estimatePinnedContextTokens(snapshot.text));
  assert.equal("content" in pinnedContextMetadata(state)[0], false);
  assert.throws(() => {
    (state.entries as PinnedContextState["entries"] & { length: number }).length = 0;
  }, TypeError);
});

test("admits deterministically under Workspace and model budgets and re-admits after unpin", () => {
  let state = createPinnedContext(identity, {
    maxItems: 3,
    maxItemBytes: 10_000,
    maxTokens: 150,
    reservedOutputTokens: 5,
  });
  for (const path of ["a.ts", "b.ts", "c.ts"]) state = pinContextPath(state, path);
  state = updateContextPath(state, ready("a.ts", "a".repeat(30)));
  state = updateContextPath(state, ready("b.ts", "b".repeat(30)));
  state = updateContextPath(state, ready("c.ts", "c".repeat(30)));
  state = setContextCapacity(state, 1_000);

  assert.equal(state.entries[0].status, "ready");
  assert.equal(state.entries[1].status, "over-budget");
  assert.equal(state.entries[1].omissionReason, "context-budget");
  assert.equal(state.entries[2].status, "over-budget");
  assert.equal(state.admittedTokens <= 145, true);

  state = unpinContextPath(state, "a.ts");
  assert.equal(state.entries[0].path, "b.ts");
  assert.equal(state.entries[0].status, "ready");
});

test("uses model capacity after reserving output and keeps unavailable entries local", () => {
  let state = createPinnedContext(identity, { maxTokens: 10_000, reservedOutputTokens: 100 });
  state = pinContextPath(state, "large.ts");
  state = updateContextPath(state, ready("large.ts", "x".repeat(200)));
  assert.equal(state.entries[0].status, "capacity-unavailable");
  assert.equal(renderPinnedContext(state).entries.length, 0);

  state = setContextCapacity(state, 120);
  assert.equal(state.entries[0].status, "over-budget");
  assert.equal(state.entries[0].omissionReason, "model-capacity");
  assert.equal(renderPinnedContext(state).entries.length, 0);
});

test("marks an over-limit item without retaining its content", () => {
  let state = createPinnedContext(identity, { maxItemBytes: 4, reservedOutputTokens: 1 });
  state = pinContextPath(state, "large.txt");
  state = updateContextPath(state, { ...ready("large.txt", "012345"), loadedAt: 10 });
  assert.equal(state.entries[0].status, "over-budget");
  assert.equal(state.entries[0].omissionReason, "per-item-bytes");
  assert.equal("content" in state.entries[0], false);
});

test("preserves typed source failures and does not leak content in the metadata view", () => {
  let state: PinnedContextState = createPinnedContext(identity);
  state = pinContextPath(state, "missing.ts");
  state = updateContextPath(state, { path: "missing.ts", status: "unreadable", reason: "File is unavailable", loadedAt: 200 });
  assert.equal(state.entries[0].status, "unreadable");
  assert.equal(state.entries[0].omissionReason, "unreadable");
  assert.equal("content" in state.entries[0], false);
  state = updateContextPath(state, { ...ready("missing.ts", "secret"), loadedAt: 300 });
  assert.equal(state.entries[0].sourceStatus, "ready");
});
