import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { WorkspaceArtifactCarrier, sessionToolRecords, type SessionEventLike } from "../src/host/workspace-artifacts.ts";
import { startWorkspace } from "../src/domain/workspace.ts";
import {
  createWorkspaceArtifactSurfaceComponent,
  type WorkspaceArtifactRemote,
} from "../src/web/workspace-artifact-surface.ts";
import TYPERT_REMOTE from "../lib/typert.remote-client.js";
import { writeFileToolEvents } from "./fixtures.ts";

const ARTIFACT = "report.md";
const CONTENT = "# Fixture report\n";

/** Build a live carrier pointed at a temp root that already contains ARTIFACT. */
async function fixtureCarrier(events: readonly SessionEventLike[]): Promise<{ carrier: WorkspaceArtifactCarrier; root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "dsh-artifacts-e2e-"));
  await writeFile(join(root, ARTIFACT), CONTENT, "utf8");
  const workspace = startWorkspace({ sessionId: "session-e2e", processCwd: root });
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => sessionToolRecords(events) });
  return { carrier, root, cleanup: async () => { await rm(root, { recursive: true, force: true }); } };
}

test("host carrier emits a non-empty WorkspaceDeliverable[] for a written file", async () => {
  const { carrier, cleanup } = await fixtureCarrier(writeFileToolEvents(ARTIFACT, CONTENT));
  const metadata = await carrier.metadata();
  assert.equal(metadata.length, 1, "one artifact derived from the write record");
  assert.equal(metadata[0]?.name, ARTIFACT);
  assert.equal(metadata[0]?.mediaType, "text/markdown");
  assert.equal(metadata[0]?.sizeBytes, Buffer.byteLength(CONTENT));
  assert.equal(metadata[0]?.resourceId, undefined, "text artifact has no opaque resource id");
  assert.equal(metadata[0]?.preview, "available");
  carrier.dispose();
  await cleanup();
});

test("Typert bridge codec preserves every field the surface relies on", async () => {
  const { carrier, cleanup } = await fixtureCarrier(writeFileToolEvents(ARTIFACT, CONTENT));
  const metadata = await carrier.metadata();
  const descriptor = TYPERT_REMOTE.descriptors.find((d) => d.method === "artifactMetadata");
  assert.ok(descriptor, "artifactMetadata descriptor exists in generated bridge");
  // The bridge validates (and would reject/drop) any malformed payload.
  const parsed = descriptor!.result.schema.parse(metadata);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, ARTIFACT);
  assert.equal(typeof parsed[0].sizeBytes, "number");
  assert.equal(parsed[0].mediaType, "text/markdown");
  carrier.dispose();
  await cleanup();
});

test("end-to-end: resolveRemote().artifactMetadata() renders a <li> in the surface", async () => {
  const { carrier, cleanup } = await fixtureCarrier(writeFileToolEvents(ARTIFACT, CONTENT));
  const metadata = await carrier.metadata();
  assert.ok(metadata.length > 0);
  const remote: WorkspaceArtifactRemote = {
    artifactMetadata: async () => ({ ok: true, value: metadata }),
    previewArtifact: async () => ({
      ok: true,
      value: { type: "markdown", renderer: "ui-primitives", content: CONTENT, truncated: false, policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] } },
    }),
  };
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };
  const render = createWorkspaceArtifactSurfaceComponent(remote, primitives, { refreshMs: 0 });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(render, { useSessions: () => "session-e2e" })); });
  await act(async () => {});
  const items = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-item");
  assert.ok(items.length >= 1, "at least one artifact <li> rendered");
  const names = tree.root.findAll((node) => node.props["data-dsh-workspace"] === "artifact-select").map((node) => node.children.join(""));
  assert.ok(names.includes(ARTIFACT), `the written file ${ARTIFACT} appears in the list`);
  carrier.dispose();
  await cleanup();
});

test("reload keeps a missing file as an unavailable metadata entry", async () => {
  const { carrier, root, cleanup } = await fixtureCarrier(writeFileToolEvents(ARTIFACT, CONTENT));
  assert.equal((await carrier.metadata()).length, 1, "present before delete");
  await rm(join(root, ARTIFACT), { force: true });
  // Re-derive from the SAME durable event log; the missing file remains
  // visible so the user can distinguish an unavailable source from an empty
  // session projection.
  const metadata = await carrier.metadata();
  assert.equal(metadata.length, 1, "unavailable artifacts keep their metadata");
  assert.equal(metadata[0]?.preview, "unavailable");
  carrier.dispose();
  await cleanup();
});

test("failure mapping: empty list -> ready/empty (not 'unavailable'); backend error -> degraded/unavailable", async () => {
  const primitives = { MarkdownText: () => null, CodeBlock: () => null, JsonTree: () => null };

  // (a) empty metadata => surface shows the empty state, never the unavailable notice.
  const emptyRemote: WorkspaceArtifactRemote = {
    artifactMetadata: async () => ({ ok: true, value: [] }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const emptyRender = createWorkspaceArtifactSurfaceComponent(emptyRemote, primitives, { refreshMs: 0 });
  let emptyTree!: TestRenderer.ReactTestRenderer;
  await act(async () => { emptyTree = TestRenderer.create(createElement(emptyRender, { useSessions: () => "session-e2e" })); });
  await act(async () => {});
  const emptyNotices = emptyTree.root.findAll((node) => node.props["data-dsh-workspace"] === "empty-state").map((node) => node.children.join(""));
  assert.ok(emptyNotices.some((t) => t.includes("No session artifacts yet")), "empty list is shown as empty, not unavailable");

  // (b) backend error (e.g. PROJECT_UNAVAILABLE) => surface degrades to 'unavailable'.
  const errRemote: WorkspaceArtifactRemote = {
    artifactMetadata: async () => ({ ok: false, error: { code: "PROJECT_UNAVAILABLE", message: "Workspace Session is unavailable", details: {} } }),
    previewArtifact: async () => ({ ok: false, error: { code: "missing", message: "missing", details: {} } }),
  };
  const errRender = createWorkspaceArtifactSurfaceComponent(errRemote, primitives, { refreshMs: 0 });
  let errTree!: TestRenderer.ReactTestRenderer;
  await act(async () => { errTree = TestRenderer.create(createElement(errRender, { useSessions: () => "session-e2e" })); });
  await act(async () => {});
  const notices = errTree.root.findAll((node) => node.type === "section").flatMap((node) =>
    node.findAll?.((n) => n.type === "p").map((n) => n.children.join("")) ?? []);
  assert.ok(notices.some((t) => t.includes("Workspace artifacts are unavailable")), "backend error degrades to the unavailable notice");

  // (c) no session events => no durable records => empty metadata (host returns []).
  const noAgentRecords = sessionToolRecords([]);
  assert.deepEqual(noAgentRecords, [], "no session events => no durable records => empty metadata");
});
