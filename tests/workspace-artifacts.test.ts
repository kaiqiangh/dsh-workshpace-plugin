import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
  assert.equal(metadata[0]?.logicalPath, "report.md");
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

test("replays standard DSH read paths without leaking host paths into the domain", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  const artifactPath = join(root, "browser-artifact.md");
  await writeFile(artifactPath, "# Browser artifact\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-absolute-read", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-write", name: "write", arguments: JSON.stringify({ file_path: "browser-artifact.md" }) } },
    { seq: 1, type: "tool/result", data: { message: { source: { callId: "call-write" }, content: [{ type: "tool-result", toolCallId: "call-write", content: [{ type: "text", text: "Created file" }] }] }, meta: { diffs: [] } } },
    { seq: 2, type: "tool/call", data: { callId: "call-read", name: "read", arguments: JSON.stringify({ file_path: artifactPath }) } },
    { seq: 3, type: "tool/result", data: { message: { source: { callId: "call-read" }, content: [{ type: "tool-result", toolCallId: "call-read" }] }, meta: { path: artifactPath } } },
  ] as const;
  const records = sessionToolRecords(events, root);
  assert.equal((records[1]?.data?.arguments as { readonly file_path?: string })?.file_path, "browser-artifact.md");
  assert.equal((records[1]?.data?.result as { readonly path?: string })?.path, "browser-artifact.md");
  const foreignPathEvents = [
    { seq: 4, type: "tool/call", data: { callId: "call-foreign-read", name: "read", arguments: JSON.stringify({ file_path: "C:\\\\outside\\\\secret.md" }) } },
    { seq: 5, type: "tool/result", data: { message: { source: { callId: "call-foreign-read" }, content: [{ type: "tool-result", toolCallId: "call-foreign-read" }] }, meta: { path: "C:\\\\outside\\\\secret.md" } } },
  ] as const;
  const foreignRecords = sessionToolRecords(foreignPathEvents, root);
  assert.equal((foreignRecords[0]?.data?.arguments as { readonly file_path?: string })?.file_path, undefined);
  assert.equal((foreignRecords[0]?.data?.result as { readonly path?: string })?.path, undefined);
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => records });
  assert.equal((await carrier.metadata()).length, 1);
  carrier.dispose();
  await rm(root, { recursive: true, force: true });
});

test("replays a DSH bash redirection as a Markdown artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "report.md"), "# Report\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-shell-write", processCwd: root });
  const callId = "call-shell-write";
  const events = [
    { seq: 0, type: "tool/call", data: { callId, name: "bash", arguments: JSON.stringify({ command: "cat > report.md << 'EOF'\n# Report\n> body text is not another path\nEOF" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: { source: { kind: "tool", callId }, content: [{ type: "tool-result", toolCallId: callId }] },
        meta: { locations: [] },
      },
    },
  ] as const;
  const records = sessionToolRecords(events);
  const result = records[0]?.data?.result as { readonly operation?: string; readonly paths?: readonly string[] };
  assert.equal(result.operation, "create");
  assert.deepEqual(result.paths, ["report.md"]);
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => records });
  const metadata = await carrier.metadata();
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0]?.logicalPath, "report.md");
  assert.equal((await carrier.previewArtifact(metadata[0]!.id)).type, "markdown");
  carrier.dispose();
  await rm(root, { recursive: true, force: true });
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

test("ignores create prose from non-write tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  await writeFile(join(root, "browser-artifact.md"), "# Browser artifact\n", "utf8");
  const workspace = startWorkspace({ sessionId: "session-non-write-prose", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-shell", name: "bash", arguments: JSON.stringify({ command: "echo Created file" }) } },
    {
      seq: 1,
      time: 1,
      type: "tool/result",
      data: {
        message: { source: { kind: "tool", callId: "call-shell" }, content: [{ type: "tool-result", toolCallId: "call-shell", content: [{ type: "text", text: "Created file" }] }] },
        meta: { diffs: [] },
      },
    },
  ] as const;
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => sessionToolRecords(events) });
  assert.equal((sessionToolRecords(events)[0]?.data?.result as { readonly operation?: string })?.operation, undefined);
  assert.deepEqual(await carrier.metadata(), []);
  carrier.dispose();
});

test("keeps shell replay bounded to explicit relative write targets", () => {
  const recordFor = (command: string, tool = "bash") => sessionToolRecords([
    { seq: 0, type: "tool/call", data: { callId: "call-shell-boundary", name: tool, arguments: JSON.stringify({ command }) } },
    { seq: 1, type: "tool/result", data: { message: { source: { kind: "tool", callId: "call-shell-boundary" }, content: [{ type: "tool-result", toolCallId: "call-shell-boundary" }] }, meta: {} } },
  ])[0]?.data?.result as { readonly paths?: readonly string[] };
  assert.deepEqual(recordFor("printf x > notes.md" ).paths, ["notes.md"]);
  assert.deepEqual(recordFor("cat <<'EOF' > later.md\ntouch false.md\n> body text\nEOF").paths, ["later.md"]);
  assert.deepEqual(recordFor("cat <<-EOF > tabbed.md\n\t> body text\n\tEOF").paths, ["tabbed.md"]);
  assert.deepEqual(recordFor("cat <<EOF > first.md\nbody\nEOF\ntouch after.md").paths, ["first.md", "after.md"]);
  assert.deepEqual(recordFor("touch empty.txt && tee copied.txt").paths, ["empty.txt", "copied.txt"]);
  assert.deepEqual(recordFor("touch first.txt\ntee second.txt").paths, ["first.txt", "second.txt"]);
  assert.deepEqual(recordFor("echo ok # comment\ntee later.md").paths, ["later.md"]);
  assert.deepEqual(recordFor("tee -- later.md").paths, ["later.md"]);
  assert.deepEqual(recordFor("touch first.md second.md").paths, ["first.md", "second.md"]);
  assert.deepEqual(recordFor("tee first.md second.md").paths, ["first.md", "second.md"]);
  assert.deepEqual(recordFor("tee existing.md -z").paths, undefined);
  assert.deepEqual(recordFor("touch first.md>log.md").paths, ["first.md", "log.md"]);
  assert.deepEqual(recordFor("touch -d tomorrow actual.md").paths, undefined);
  assert.deepEqual(recordFor("touch first.md -r reference.md").paths, undefined);
  assert.deepEqual(recordFor("touch -d tomorrow actual.md && printf x > later.md").paths, ["later.md"]);
  assert.deepEqual(recordFor("touch -- actual.md").paths, ["actual.md"]);
  assert.deepEqual(recordFor("touch < actual.md").paths, undefined);
  assert.deepEqual(recordFor("printf x >> appended.md").paths, ["appended.md"]);
  assert.deepEqual(recordFor("cat > /tmp/out.md && cat > ../secret.md").paths, undefined);
  assert.deepEqual(recordFor("printf 'not a write > false.md'").paths, undefined);
  assert.deepEqual(recordFor("[[ a > b ]]").paths, undefined);
  assert.deepEqual(recordFor("(( a > b ))").paths, undefined);
  assert.deepEqual(recordFor("if [[ a > b ]]; then echo > good.md; fi").paths, ["good.md"]);
  assert.deepEqual(recordFor("if (( a > b )); then echo > good-arith.md; fi").paths, ["good-arith.md"]);
  assert.deepEqual(recordFor("printf x \\> false.md").paths, undefined);
  assert.deepEqual(recordFor("echo ok # > false.md").paths, undefined);
  assert.deepEqual(recordFor("cat > file:///tmp/secret.md").paths, undefined);
  assert.deepEqual(recordFor("cat > bad\u0000name.md").paths, undefined);
  assert.deepEqual(recordFor("Write-Output x > windows.md", "pwsh").paths, ["windows.md"]);
  assert.deepEqual(recordFor("cat README.md").paths, undefined);
});

test("drops traversal paths before replay reaches the workspace observer", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  const workspace = startWorkspace({ sessionId: "session-traversal-read", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-traversal-read", name: "read", arguments: JSON.stringify({ file_path: "../secret.md" }) } },
    { seq: 1, type: "tool/result", data: { message: { source: { callId: "call-traversal-read" }, content: [{ type: "tool-result", toolCallId: "call-traversal-read" }] }, meta: { path: "../secret.md" } } },
  ] as const;
  const records = sessionToolRecords(events, root);
  assert.equal((records[0]?.data?.arguments as { readonly file_path?: string })?.file_path, undefined);
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => records });
  assert.deepEqual(await carrier.metadata(), []);
  carrier.dispose();
  await rm(root, { recursive: true, force: true });
});

test("drops URI and control-character paths before replay", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-workspace-artifact-"));
  const workspace = startWorkspace({ sessionId: "session-invalid-read", processCwd: root });
  const events = [
    { seq: 0, type: "tool/call", data: { callId: "call-invalid-read", name: "read", arguments: JSON.stringify({ file_path: "file:///tmp/secret.md" }) } },
    { seq: 1, type: "tool/result", data: { message: { source: { callId: "call-invalid-read" }, content: [{ type: "tool-result", toolCallId: "call-invalid-read" }] }, meta: { path: "bad\u0000name" } } },
  ] as const;
  const records = sessionToolRecords(events, root);
  assert.equal((records[0]?.data?.arguments as { readonly file_path?: string })?.file_path, undefined);
  assert.equal((records[0]?.data?.result as { readonly path?: string })?.path, undefined);
  const carrier = new WorkspaceArtifactCarrier({ workspace, root, records: () => records });
  assert.deepEqual(await carrier.metadata(), []);
  carrier.dispose();
  await rm(root, { recursive: true, force: true });
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
