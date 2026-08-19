import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMemoryRevision,
  exportMemoryBundle,
  exportMemoryMarkdown,
  importMemoryBundle,
  importMemoryMarkdown,
  memoryGovernanceEligible,
  MemoryGovernanceError,
  sourceRef,
  transitionMemoryGovernance,
} from "../src/domain/memory-governance.ts";
import type { MemoryRecord } from "../src/domain/memory-store.ts";

function record(): MemoryRecord {
  return {
    schemaVersion: 1,
    id: "memory:governed",
    scope: "project",
    scopeKey: "root:one",
    type: "decision",
    title: "Use review",
    content: "Review before context use",
    tags: ["governance"],
    provenance: { kind: "import", note: "fixture" },
    createdAt: 1,
    updatedAt: 1,
    useCount: 0,
    contentHash: "sha256:0d47c2b8c3b7680ab3550031a9d01621f795c686cf6af82b2a48e81c6598f455",
    status: "active",
    governance: {
      origin: "imported",
      sourceRefs: [sourceRef("import", "bundle-1")],
      verification: "unverified",
      revision: 1,
      retention: "project-delete",
    },
  };
}

test("requires explicit verification before pinning and keeps stale records ineligible", () => {
  const unverified = record();
  assert.equal(memoryGovernanceEligible(unverified, 10), false);
  const verified = transitionMemoryGovernance(unverified, "verify", "user", 10);
  assert.equal(memoryGovernanceEligible(verified, 10), true);
  const pinned = transitionMemoryGovernance(verified, "pin", "user", 11);
  assert.equal(pinned.governance?.pinnedBy, "user");
  const stale = transitionMemoryGovernance(pinned, "stale", "trusted-tool", 12);
  assert.equal(memoryGovernanceEligible(stale, 12), false);
  assert.equal(stale.governance?.pinnedAt, undefined);
  assert.throws(() => transitionMemoryGovernance(stale, "pin"), (error) => error instanceof MemoryGovernanceError && error.code === "INELIGIBLE");
  const restored = transitionMemoryGovernance(transitionMemoryGovernance(stale, "reverify", "user", 13), "archive", "user", 14);
  assert.equal(restored.status, "archived");
  assert.equal(transitionMemoryGovernance(restored, "restore", "user", 15).status, "active");
  assert.equal(transitionMemoryGovernance(restored, "forget", "user", 16).status, "forgotten");
});
test("preserves optimistic conflicts and remaps imported IDs into quarantine state", () => {
  const current = record();
  assert.doesNotThrow(() => assertMemoryRevision(current, 1, current.contentHash));
  assert.throws(() => assertMemoryRevision(current, 2, current.contentHash), (error) => error instanceof MemoryGovernanceError && error.code === "CONFLICT");
  const imported = importMemoryBundle(exportMemoryBundle([current], 20), 21);
  assert.equal(imported.length, 1);
  assert.notEqual(imported[0]!.id, current.id);
  assert.equal(imported[0]!.governance?.origin, "imported");
  assert.equal(imported[0]!.governance?.verification, "unverified");
});


test("markdown export round-trips through markdown import (multi-line content)", () => {
  const current = record();
  const multiline = {
    ...current,
    id: "memory:md-1",
    title: "Markdown note",
    content: "first line\nsecond line\n\n- bullet one\n- bullet two",
    tags: ["md", "notes"],
    governance: { ...current.governance, verification: "verified" as const, origin: "derived" as const, retention: "project-delete" as const },
    updatedAt: 1_700_000_000_000,
  };
  const markdown = exportMemoryMarkdown([multiline]);
  assert.ok(markdown.startsWith("# Markdown note\n"), "title renders as an H1");
  assert.ok(markdown.includes("type: decision"), "type metadata is emitted");
  assert.ok(markdown.includes("tags: md, notes"), "tags metadata is emitted");
  assert.ok(markdown.includes("first line\nsecond line"), "multi-line content survives verbatim");

  const imported = importMemoryMarkdown(markdown);
  assert.equal(imported.length, 1);
  assert.equal(imported[0]!.title, "Markdown note");
  assert.equal(imported[0]!.content, "first line\nsecond line\n\n- bullet one\n- bullet two");
  assert.equal(imported[0]!.type, "decision");
  assert.deepEqual(imported[0]!.tags, ["md", "notes"]);
  assert.equal(imported[0]!.governance?.verification, "verified");
  assert.equal(imported[0]!.governance?.origin, "derived");
  assert.equal(imported[0]!.governance?.retention, "project-delete");
  assert.match(imported[0]!.id, /^memory:import:/u);
  assert.match(imported[0]!.contentHash, /^sha256:[0-9a-f]{64}$/u);
});

test("markdown import parses multiple sections and rejects malformed input", () => {
  const source = [
    "# First",
    "",
    "type: decision",
    "",
    "decide something",
    "",
    "---",
    "",
    "# Second",
    "",
    "type: convention",
    "tags: a, b",
    "",
    "follow the convention",
  ].join("\n");
  const imported = importMemoryMarkdown(source);
  assert.equal(imported.length, 2);
  assert.equal(imported[0]!.title, "First");
  assert.equal(imported[0]!.type, "decision");
  assert.equal(imported[1]!.title, "Second");
  assert.equal(imported[1]!.type, "convention");
  assert.deepEqual(imported[1]!.tags, ["a", "b"]);

  assert.throws(() => importMemoryMarkdown("# no body"), MemoryGovernanceError);
  assert.throws(() => importMemoryMarkdown("plain text without a heading"), MemoryGovernanceError);
  assert.throws(() => importMemoryMarkdown("# Bad type\n\ntype: nope\n\nbody"), MemoryGovernanceError);
});
