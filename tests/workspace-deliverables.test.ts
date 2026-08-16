import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceArtifactDetail, createWorkspaceArtifactView, createWorkspaceDownloadController, buildWorkspaceResourceUrl, type WorkspaceDownloadRuntime } from "../src/web/workspace-deliverables.ts";
import type { WorkspaceDeliverable } from "../src/domain/deliverable.ts";

const markdown: WorkspaceDeliverable = {
  id: "workspace:report",
  name: "report.md",
  mediaType: "text/markdown",
  sizeBytes: 42,
  source: { sessionId: "session-1", workspaceId: "root:abc", kind: "artifact" },
  preview: "available",
  resourceId: "resource-report",
  downloadName: "report.md",
};

const image: WorkspaceDeliverable = {
  id: "workspace:image",
  name: "chart.png",
  mediaType: "image/png",
  sizeBytes: 12,
  source: { sessionId: "session-1", workspaceId: "root:abc", kind: "artifact" },
  preview: "available",
  resourceId: "resource-image",
  downloadName: "chart.png",
  altText: "Chart",
};

test("orders artifact metadata and keeps paths out of the browser envelope", () => {
  const view = createWorkspaceArtifactView([image, markdown], "workspace:image");
  assert.deepEqual(view.items.map((item) => item.name), ["chart.png", "report.md"]);
  assert.equal(view.selected?.id, "workspace:image");
  assert.equal("path" in view.items[0], false);
  assert.equal(buildWorkspaceResourceUrl(markdown), "/workspace/resource?id=resource-report&type=text%2Fmarkdown&download=1");
  assert.throws(() => buildWorkspaceResourceUrl({ ...markdown, name: "/Users/kai/secret.txt" }), /metadata is invalid/);
  const forged = createWorkspaceArtifactView([{ ...markdown, path: "/Users/kai/secret.txt" } as WorkspaceDeliverable & { path: string }]);
  assert.equal("path" in forged.items[0], false);
  assert.throws(() => createWorkspaceArtifactView([{ ...markdown, source: { ...markdown.source, workspaceId: "/Users/kai" } }]), /metadata is invalid/);
});

test("keeps typed stale, unsupported, and identity-mismatch detail states local", () => {
  const unsupported = createWorkspaceArtifactDetail({ ...markdown, preview: "unsupported" });
  assert.equal(unsupported.status, "unsupported");
  const stale = createWorkspaceArtifactDetail(markdown, { type: "error", code: "RESOURCE_STALE", message: "Resource is stale" });
  assert.equal(stale.status, "stale");
  const mismatch = createWorkspaceArtifactDetail(markdown, { type: "binary", path: "report.md" as never, mediaType: "image/png", resourceId: "other", version: "v1", expiresAt: 1 });
  assert.equal(mismatch.status, "error");
  assert.equal(mismatch.message, "Preview resource identity is invalid");
  assert.equal(createWorkspaceArtifactDetail({ ...markdown, mediaType: "application/pdf", name: "report.pdf", downloadName: "report.pdf" }, { type: "binary", path: "/Users/kai/secret.pdf" as never, mediaType: "application/pdf", resourceId: "resource-report", version: "v1", expiresAt: 1 }).descriptor, undefined);
  assert.throws(() => createWorkspaceArtifactView([{ ...markdown, name: "/tmp/secret" }]), /metadata is invalid/);
});

test("downloads through an opaque route and cancels active browser reads", async () => {
  let mode: "ok" | "cancel" | "stale" = "ok";
  let objectUrls = 0;
  const revoked: string[] = [];
  const runtime: WorkspaceDownloadRuntime = {
    async fetch(_url, { signal }) {
      if (mode === "stale") return { ok: false, status: 410, blob: async () => new Blob() };
      if (mode === "cancel") {
        await new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }));
      }
      return { ok: true, status: 200, blob: async () => new Blob(["data"]) };
    },
    createObjectURL() { objectUrls += 1; return `blob:workspace-${objectUrls}`; },
    revokeObjectURL(url) { revoked.push(url); },
  };
  const controller = createWorkspaceDownloadController(runtime);
  const ready = await controller.start(markdown);
  assert.deepEqual(ready, { status: "ready", url: "blob:workspace-1", downloadName: "report.md" });
  controller.release(ready.url!);
  assert.deepEqual(revoked, ["blob:workspace-1"]);
  mode = "stale";
  assert.equal((await controller.start(markdown)).status, "stale");
  mode = "cancel";
  const pending = controller.start(markdown);
  controller.cancel();
  assert.equal((await pending).status, "cancelled");
  assert.equal((await controller.start({ ...markdown, resourceId: undefined })).status, "unsupported");
});
