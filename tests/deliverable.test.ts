import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWorkspaceDeliverable,
  safeDownloadName,
  WorkspaceDeliverableError,
} from "../src/domain/deliverable.ts";
import { PreviewService } from "../src/domain/preview.ts";
import { installWorkspaceResourceRoute } from "../src/host/workspace-resource.ts";

const identity = { sessionId: "deliverable-session", rootId: "root:deliverable" };

test("builds bounded deliverable metadata with a safe download name", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-deliverable-"));
  try {
    await writeFile(join(root, "report<>.png"), Buffer.from([1, 2, 3]));
    const service = new PreviewService(root, identity);
    const descriptor = await service.preview("report<>.png");
    assert.equal(descriptor.type, "binary");
    if (descriptor.type !== "binary") return;
    const deliverable = createWorkspaceDeliverable(descriptor, {
      sessionId: identity.sessionId,
      workspaceId: identity.rootId,
      kind: "artifact",
    }, 3);
    assert.equal(deliverable.preview, "available");
    assert.equal(deliverable.mediaType, "image/png");
    assert.equal(deliverable.version, descriptor.version);
    assert.equal(deliverable.downloadName, "report__.png");
    assert.equal(deliverable.resourceId, descriptor.resourceId);
    assert.deepEqual(deliverable.source, { sessionId: identity.sessionId, workspaceId: identity.rootId, kind: "artifact" });
    assert.equal(deliverable.id.includes("report"), false);
    await writeFile(join(root, "报告.png"), Buffer.from([4, 5, 6]));
    const unicode = await service.preview("报告.png");
    assert.equal(unicode.type, "binary");
    if (unicode.type === "binary") {
      const opened = await service.openResource(unicode.resourceId, { identity, mediaType: "image/png" });
      assert.equal(opened.downloadName, "__.png");
    }
    assert.equal("content" in deliverable, false);
    service.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsafe deliverable metadata and normalizes fallback names", () => {
  assert.equal(safeDownloadName("..."), "workspace-download.bin");
  assert.equal(safeDownloadName("report.pdf", "application/pdf"), "report.pdf");
  assert.throws(() => safeDownloadName("../secret.txt"), WorkspaceDeliverableError);
});

test("serves opaque resources only through the authorized route and disposes it", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-resource-route-"));
  try {
    await writeFile(join(root, "photo.png"), Buffer.from([7, 8, 9]));
    let now = 0;
    const service = new PreviewService(root, identity, { resourceTtlMs: 10, now: () => now });
    const descriptor = await service.preview("photo.png");
    assert.equal(descriptor.type, "binary");
    if (descriptor.type !== "binary") return;
    let route: { handler: (request: any, response: any) => void | Promise<void> } | undefined;
    let disposed = false;
    const registrar = {
      register(value: { handler: typeof route extends { handler: infer Handler } ? Handler : never }) {
        route = value as typeof route;
        return () => { disposed = true; };
      },
    };
    let cleanup: (() => void) | undefined;
    installWorkspaceResourceRoute({ effect(factory) { cleanup = factory() as (() => void) | undefined; } }, registrar, { preview: service });
    assert.ok(route);
    const response = () => {
      const result: { status?: number; headers?: Record<string, string | number>; body?: Buffer } = {};
      return Object.assign(result, {
        writeHead(status: number, headers: Record<string, string | number>) { result.status = status; result.headers = headers; },
        end(body?: Uint8Array) { result.body = body ? Buffer.from(body) : Buffer.alloc(0); },
      });
    };
    const authorized = response();
    await route!.handler({
      url: `/workspace/resource?id=${encodeURIComponent(descriptor.resourceId)}&type=image%2Fpng&download=1`,
      headers: { "x-dsh-session": identity.sessionId, "x-dsh-root": identity.rootId },
    }, authorized);
    assert.equal(authorized.status, 200);
    assert.deepEqual([...authorized.body!], [7, 8, 9]);
    assert.match(String(authorized.headers!["content-disposition"]), /photo\.png/);

    const denied = response();
    await route!.handler({
      url: `/workspace/resource?id=${encodeURIComponent(descriptor.resourceId)}&type=image%2Fpng`,
      headers: { "x-dsh-session": "other", "x-dsh-root": identity.rootId },
    }, denied);
    assert.equal(denied.status, 404);
    const wrongType = response();
    await route!.handler({
      url: `/workspace/resource?id=${encodeURIComponent(descriptor.resourceId)}&type=text%2Fplain`,
      headers: { "x-dsh-session": identity.sessionId, "x-dsh-root": identity.rootId },
    }, wrongType);
    assert.equal(wrongType.status, 404);

    await writeFile(join(root, "photo.png"), Buffer.from([10, 11, 12, 13]));
    const stale = response();
    await route!.handler({
      url: `/workspace/resource?id=${encodeURIComponent(descriptor.resourceId)}&type=image%2Fpng`,
      headers: { "x-dsh-session": identity.sessionId, "x-dsh-root": identity.rootId },
    }, stale);
    assert.equal(stale.status, 410);

    const expiring = await service.preview("photo.png");
    assert.equal(expiring.type, "binary");
    now = 11;
    const expired = response();
    if (expiring.type === "binary") {
      await route!.handler({
        url: `/workspace/resource?id=${encodeURIComponent(expiring.resourceId)}&type=image%2Fpng`,
        headers: { "x-dsh-session": identity.sessionId, "x-dsh-root": identity.rootId },
      }, expired);
    }
    assert.equal(expired.status, 410);

    cleanup?.();
    assert.equal(disposed, true);
    await assert.rejects(() => service.openResource(descriptor.resourceId, { identity }), /Resource is expired/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
