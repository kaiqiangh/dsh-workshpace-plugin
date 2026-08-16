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

test("rejects unknown artifact ids without touching the filesystem", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  const workspace = startWorkspace({ sessionId: "session-2", processCwd: root });
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => [] });
  assert.deepEqual(await carrier.previewArtifact("workspace:missing"), { type: "error", code: "RESOURCE_INVALID", message: "Artifact is unavailable" });
  carrier.dispose();
});
