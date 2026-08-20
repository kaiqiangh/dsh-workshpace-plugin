import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceMemoryDomain } from "../src/domain/memory.ts";
import type { MemoryRecord } from "../src/domain/memory-store.ts";
import { startWorkspace } from "../src/domain/workspace.ts";
import {
  attachWorkspaceMemoryAutoWriter,
  AUTO_FACT_TITLE,
  buildAutoFactContent,
  writeAutoFact,
} from "../src/host/workspace-memory-auto-write.ts";

async function domainAndRoot() {
  const dshHome = await mkdtemp(join(tmpdir(), "dsh-autowrite-home-"));
  const root = await mkdtemp(join(tmpdir(), "dsh-autowrite-root-"));
  const memoryDomain = new WorkspaceMemoryDomain(join(dshHome, "home"));
  return { memoryDomain, root };
}

function sessionSeam(root: string) {
  const identity = startWorkspace({ sessionId: "session-1", processCwd: root }).identity;
  return {
    context: { identity, root },
    request: { scope: "session" as const },
    scopeKey: `${identity.sessionId}|${identity.rootId}`,
  };
}

/** Two durable events per path: tool/call + tool/result with a created message. */
function eventsFor(paths: readonly string[]): readonly { readonly seq: number; readonly type: string; readonly data: Record<string, unknown> }[] {
  const events: { readonly seq: number; readonly type: string; readonly data: Record<string, unknown> }[] = [];
  paths.forEach((path, index) => {
    const seq = index * 2 + 1;
    events.push({
      seq,
      type: "tool/call",
      data: { callId: `call-${index + 1}`, name: "write_file", arguments: JSON.stringify({ file_path: path, content: "x" }) },
    });
    events.push({
      seq: seq + 1,
      type: "tool/result",
      data: {
        message: {
          source: { callId: `call-${index + 1}` },
          content: [{ type: "text", text: `Created file ${path}` }],
        },
      },
    });
  });
  return events;
}

function captureHandler() {
  let handler: ((exec: { readonly agent: unknown }) => void) | undefined;
  const ctx = {
    on: (name: string, next: (exec: { readonly agent: unknown }) => void) => {
      assert.equal(name, "tools/result");
      handler = next;
    },
  };
  return { ctx, fire: (agent: unknown) => handler!({ agent }) };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function listActive(memoryDomain: WorkspaceMemoryDomain, root: string): Promise<readonly MemoryRecord[]> {
  const { context, request } = sessionSeam(root);
  return memoryDomain.list(context, request, { status: "active", limit: 100 });
}

/** Poll until `predicate` holds (or ~8s elapse), giving debounced flushes time to finish. */
async function waitForRecords(memoryDomain: WorkspaceMemoryDomain, root: string, predicate: (records: readonly MemoryRecord[]) => boolean): Promise<readonly MemoryRecord[]> {
  let records: readonly MemoryRecord[] = [];
  for (let attempt = 0; attempt < 160; attempt += 1) {
    records = await listActive(memoryDomain, root);
    if (predicate(records)) return records;
    await sleep(50);
  }
  return records;
}

test("builds a deterministic, readable digest from touched files and artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-autowrite-content-"));
  const identity = startWorkspace({ sessionId: "session-1", processCwd: root }).identity;
  const { SessionActivityObserver } = await import("../src/domain/observation.ts");
  const { sessionToolRecords } = await import("../src/host/workspace-artifacts.ts");
  const { deriveArtifacts } = await import("../src/domain/activity.ts");
  const observer = new SessionActivityObserver(
    identity,
    startWorkspace({ sessionId: "session-1", processCwd: root }).baseline,
  );
  observer.resume(sessionToolRecords(eventsFor(["out/report.md", "out/data.json"]) as never));
  const files = [...observer.projection.files.values()];
  const artifacts = deriveArtifacts(observer.projection);
  const content = buildAutoFactContent(files, artifacts);
  assert.match(content, /Files touched: 2 \(2 created, 0 modified, 0 deleted\)\./u);
  assert.match(content, /Created: out\/report\.md, out\/data\.json/u);
  assert.match(content, /Artifacts: 2/u);
});

test("auto-writes a derived, unverified session fact after tools/result debounce", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  const { ctx, fire } = captureHandler();
  const dispose = attachWorkspaceMemoryAutoWriter(ctx as never, memoryDomain);
  const agent = {
    id: "session-1",
    session: { header: { cwd: root }, events: eventsFor(["out/report.md", "out/data.json"]) },
  };
  fire(agent);
  const records = await waitForRecords(memoryDomain, root, (items) => items.length >= 1);
  assert.equal(records.length, 1);
  const record = records[0]!;
  assert.equal(record.type, "fact");
  assert.equal(record.title, AUTO_FACT_TITLE);
  assert.equal(record.scope, "session");
  assert.match(record.id, /^memory:auto:fact:/u);
  assert.equal(record.provenance.kind, "tool");
  assert.equal(record.provenance.sessionId, "session-1");
  assert.equal(record.provenance.note, "workspace auto-writer");
  assert.equal(record.governance?.origin, "derived");
  assert.equal(record.governance?.verification, "unverified");
  assert.equal(record.governance?.retention, "session-end");
  assert.ok(record.governance?.sourceRefs.some((source) => source.kind === "session" && source.id === "session-1"));
  assert.match(record.content, /Created: out\/report\.md, out\/data\.json/u);
  assert.match(record.content, /Artifacts: 2/u);
  dispose();
  await memoryDomain.dispose();
});

test("repeated identical digests merge into the same stable-id record", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  const { ctx, fire } = captureHandler();
  const dispose = attachWorkspaceMemoryAutoWriter(ctx as never, memoryDomain);
  const events = eventsFor(["out/report.md"]);
  const agent = { id: "session-1", session: { header: { cwd: root }, events } };
  fire(agent);
  const first = await waitForRecords(memoryDomain, root, (items) => items.length >= 1);
  assert.equal(first.length, 1);
  const firstId = first[0]!.id;
  fire(agent);
  await sleep(700);
  const second = await listActive(memoryDomain, root);
  assert.equal(second.length, 1, "identical digests must not pile up records");
  assert.equal(second[0]!.id, firstId, "identical digests must reuse the stable id");
  dispose();
  await memoryDomain.dispose();
});

test("a changed digest writes a new stable-id record and keeps the count bounded", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  const { ctx, fire } = captureHandler();
  const dispose = attachWorkspaceMemoryAutoWriter(ctx as never, memoryDomain);
  const agent = (paths: readonly string[]) => ({ id: "session-1", session: { header: { cwd: root }, events: eventsFor(paths) } });
  fire(agent(["out/a.md"]));
  await waitForRecords(memoryDomain, root, (items) => items.length >= 1);
  fire(agent(["out/a.md", "out/b.md"]));
  await waitForRecords(memoryDomain, root, (items) => items.length >= 2);
  const records = await listActive(memoryDomain, root);
  assert.equal(records.length, 2, "a distinct digest is a distinct fact");
  assert.notEqual(records[0]!.id, records[1]!.id);
  assert.ok(records.some((record) => record.content.includes("out/b.md")), "the newest digest content must reflect the added file");
  // Emit many distinct digests: the writer must prune beyond the per-session bound.
  const paths = ["c.md", "d.md", "e.md", "f.md", "g.md", "h.md", "i.md"];
  for (const path of paths) {
    const full = `out/${path}`;
    fire(agent(["out/a.md", "out/b.md", full]));
    await waitForRecords(memoryDomain, root, (items) => items.some((record) => record.content.includes(full)));
  }
  // The prune is debounced (~500ms); let it flush before asserting the bound.
  await sleep(700);
  const pruned = await listActive(memoryDomain, root);
  assert.ok(pruned.length <= 6, "auto-fact digests must be pruned to a bounded set");
  assert.ok(pruned.some((record) => record.content.includes("out/i.md")), "the newest digest must survive pruning");
  dispose();
  await memoryDomain.dispose();
});

test("writeAutoFact returns undefined when a session has nothing useful", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  const agent = { id: "session-1", session: { header: { cwd: root }, events: [] } };
  assert.equal(await writeAutoFact(memoryDomain, agent), undefined);
  assert.equal((await listActive(memoryDomain, root)).length, 0);
  await memoryDomain.dispose();
});

test("is a silent no-op without a Memory domain or with an unusable session", async () => {
  const { memoryDomain, root } = await domainAndRoot();
  const events = eventsFor(["out/a.md"]);
  // No Memory domain: nothing should be scheduled or thrown.
  const withoutDomain = captureHandler();
  const disposeWithout = attachWorkspaceMemoryAutoWriter(withoutDomain.ctx as never);
  withoutDomain.fire({ id: "session-1", session: { header: { cwd: root }, events } });
  await sleep(600);
  disposeWithout();
  // Unusable cwd with a Memory domain: the flush must swallow the identity failure.
  const withDomain = captureHandler();
  const disposeWith = attachWorkspaceMemoryAutoWriter(withDomain.ctx as never, memoryDomain);
  withDomain.fire({ id: "session-1", session: { header: { cwd: join(root, "missing"), events } } });
  await sleep(600);
  disposeWith();
  assert.equal((await listActive(memoryDomain, root)).length, 0);
  await memoryDomain.dispose();
});
