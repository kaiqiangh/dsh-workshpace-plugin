import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMemoryRevision,
  exportMemoryBundle,
  importMemoryBundle,
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
