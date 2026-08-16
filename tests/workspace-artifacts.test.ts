import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { WorkspaceArtifactCarrier, sessionToolRecords } from "../src/host/workspace-artifacts.ts";
import { startWorkspace } from "../src/domain/workspace.ts";

test("derives path-free session artifact metadata and typed previews", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "report.md"), "# Report\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-1", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-1", name: "write_file", arguments: JSON.stringify({ path: "report.md" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: { source: { kind: "tool", callId: "call-1" }, content: [{ type: "tool-result", toolCallId: "call-1" }] },
        meta: { diffs: [{ path: "report.md", oldText: null, newText: "# Report\n" }] },
      },
    },
  ] as const;
  const carrier = new WorkspaceArtifactCarrier({
    workspace,
    root,
    records: () => sessionToolRecords(events),
  });
  const metadata = await carrier.metadata();
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0]?.name, "report.md");
  assert.equal("path" in (metadata[0] ?? {}), false);
  const preview = await carrier.previewArtifact(metadata[0]!.id);
  assert.deepEqual(preview, { type: "markdown", renderer: "ui-primitives", content: "# Report\n", truncated: false, policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] } });
  assert.equal(JSON.stringify(preview).includes(root), false);
  carrier.dispose();
});

test("derives artifacts from the Harness write result envelope", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "browser-artifact.md"), "# Browser artifact\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-write-envelope", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-write", name: "write", arguments: JSON.stringify({ file_path: "browser-artifact.md", content: "# Browser artifact\n" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: {
          source: { kind: "tool", callId: "call-write" },
          content: [{ type: "tool-result", toolCallId: "call-write", content: [{ type: "text", text: "<path>/private/tmp/browser-artifact.md</path>\n<type>file</type>\n<content>\nCreated file\n</content>" }] }],
        },
        meta: { diffs: [] },
      },
    },
  ] as const;
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => sessionToolRecords(events) });
  const metadata = await carrier.metadata();
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0]?.name, "browser-artifact.md");
  assert.equal((sessionToolRecords(events)[0]?.data?.result as { readonly operation?: string })?.operation, "create");
  assert.equal((await carrier.previewArtifact(metadata[0]!.id)).type, "markdown");
  carrier.dispose();
});

test("does not derive Harness write updates as new artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "browser-artifact.md"), "# Updated artifact\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-write-update", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-update", name: "write", arguments: JSON.stringify({ file_path: "browser-artifact.md", content: "# Updated artifact\n" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: {
          source: { kind: "tool", callId: "call-update" },
          content: [{ type: "tool-result", toolCallId: "call-update", content: [{ type: "text", text: "Updated file" }] }],
        },
        meta: { diffs: [{ path: "browser-artifact.md", oldText: "# Original artifact\n", newText: "# Updated artifact\n" }] },
      },
    },
  ] as const;
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => sessionToolRecords(events) });
  assert.equal((sessionToolRecords(events)[0]?.data?.result as { readonly operation?: string })?.operation, "update");
  assert.deepEqual(await carrier.metadata(), []);
  carrier.dispose();
});

test("fails closed when a replayed write result has no operation evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "browser-artifact.md"), "# Browser artifact\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-write-unknown", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-unknown", name: "write", arguments: JSON.stringify({ file_path: "browser-artifact.md", content: "# Browser artifact\n" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: { source: { kind: "tool", callId: "call-unknown" }, content: [{ type: "tool-result", toolCallId: "call-unknown", content: [] }] },
        meta: { diffs: [] },
      },
    },
  ] as const;
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => sessionToolRecords(events) });
  assert.deepEqual(await carrier.metadata(), []);
  carrier.dispose();
});

test("rejects unknown artifact ids without touching the filesystem", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  const workspace = startWorkspace({ sessionId: "session-2", processCwd: root });
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => [] });
  assert.deepEqual(await carrier.previewArtifact("workspace:missing"), { type: "error", code: "RESOURCE_INVALID", message: "Artifact is unavailable" });
  carrier.dispose();
});

test("reuses the metadata resource for binary artifact previews", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "chart.png"), Buffer.from("bounded"));
  const workspace = startWorkspace({ sessionId: "session-3", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-3", name: "write_file", arguments: JSON.stringify({ path: "chart.png" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: { source: { kind: "tool", callId: "call-3" }, content: [{ type: "tool-result", toolCallId: "call-3" }] },
        meta: { diffs: [{ path: "chart.png", oldText: null, newText: "bounded" }] },
      },
    },
  ] as const;
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => sessionToolRecords(events) });
  const metadata = await carrier.metadata();
  assert.equal(metadata[0]?.resourceId !== undefined, true);
  const refreshed = await carrier.metadata();
  assert.equal(refreshed[0]?.id, metadata[0]?.id);
  assert.equal(refreshed[0]?.resourceId, metadata[0]?.resourceId);
  const preview = await carrier.previewArtifact(metadata[0]!.id);
  assert.equal(preview.type, "binary");
  assert.equal(preview.type === "binary" ? preview.resourceId : undefined, metadata[0]!.resourceId);
  carrier.dispose();
});
