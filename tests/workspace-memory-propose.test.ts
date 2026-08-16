import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceMemoryDomain } from "../src/domain/memory.ts";
import { MemoryStoreError } from "../src/domain/memory-store.ts";
import { startWorkspace } from "../src/domain/workspace.ts";
import {
  createMemoryProposeTool,
  MEMORY_PROPOSE_SECTION,
  MEMORY_PROPOSE_TOOL_NAME,
  proposeMemory,
} from "../src/host/workspace-memory-propose.ts";

async function domainAndRoot() {
  const dshHome = await mkdtemp(join(tmpdir(), "dsh-propose-home-"));
  const root = await mkdtemp(join(tmpdir(), "dsh-propose-root-"));
  const memoryDomain = new WorkspaceMemoryDomain(join(dshHome, "home"));
  return { memoryDomain, root };
}

const agent = {
  id: "session-1",
  session: { header: { cwd: "/tmp" } },
};

test("proposal tool carries the pinned name and output contract", () => {
  const { memoryDomain } = { memoryDomain: new WorkspaceMemoryDomain(join(tmpdir(), "unused-home")) };
  const tool = createMemoryProposeTool(memoryDomain);
  assert.equal(tool.name, MEMORY_PROPOSE_TOOL_NAME);
  assert.equal(typeof tool.execute, "function");
  assert.deepEqual(tool.output.schema, { type: "string" });
  assert.equal(MEMORY_PROPOSE_SECTION, "dsh-workspace-memory");
});

test("proposeMemory writes a model-suggested unverified record with a session source", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  const identity = startWorkspace({ sessionId: agent.id, processCwd: root }).identity;
  const context = { identity, root };
  const request = { scope: "project" as const };
  const saved = await proposeMemory(memoryDomain, { ...agent, session: { header: { cwd: root } } }, {
    scope: "project",
    type: "convention",
    title: "Use JSONL for records",
    content: "Keep project memory inspectable with ordinary tools.",
    tags: ["storage"],
  }, "tool-call-1");

  const records = await memoryDomain.list(context, request);
  assert.equal(saved.scope, "project");
  const record = records.find((item) => item.id === saved.id);
  assert.ok(record);
  assert.equal(record?.provenance.kind, "agent");
  assert.equal(record?.provenance.sessionId, "session-1");
  assert.equal(record?.governance?.origin, "model-suggested");
  assert.equal(record?.governance?.verification, "unverified");
  assert.equal(record?.governance?.sourceRefs[0]?.kind, "session");
  assert.equal(record?.governance?.sourceRefs[0]?.id, "session-1");
  assert.equal(record?.governance?.sourceRefs[1]?.kind, "event");
  assert.equal(record?.governance?.sourceRefs[1]?.id, "tool-call-1");
  assert.equal(record?.governance?.retention, "project-delete");
  await memoryDomain.dispose();
});

test("proposeMemory rejects invalid types and unavailable roots", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  await assert.rejects(
    () => proposeMemory(memoryDomain, { ...agent, session: { header: { cwd: root } } }, {
      type: "not-a-type" as never,
      title: "Bad",
      content: "Bad",
    }),
    (error: unknown) => error instanceof MemoryStoreError && error.code === "INVALID_RECORD",
  );
  await assert.rejects(
    () => proposeMemory(memoryDomain, { id: "session-1", session: { header: { cwd: join(root, "missing") } } }, {
      type: "fact",
      title: "Bad root",
      content: "Bad root",
    }),
    (error: unknown) => error instanceof MemoryStoreError && error.code === "PROJECT_UNAVAILABLE",
  );
  await memoryDomain.dispose();
});
