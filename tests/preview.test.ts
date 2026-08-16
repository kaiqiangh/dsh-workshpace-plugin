import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PreviewPanelError, PreviewService } from "../src/domain/preview.ts";

const identity = { sessionId: "preview-session", rootId: "root:preview" };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "dsh-preview-"));
  const outside = await mkdtemp(join(tmpdir(), "dsh-preview-outside-"));
  await mkdir(join(root, "safe"));
  await writeFile(join(root, "safe", "readme.md"), "# Safe\n<img src=\"https://remote.invalid/x.png\">\n");
  await writeFile(join(outside, "secret.txt"), "not in workspace");
  await symlink(outside, join(root, "escape"), "dir");
  return { root, outside };
}

test("normalizes and contains paths before preview access", async () => {
  const { root, outside } = await fixture();
  try {
    const service = new PreviewService(root, identity);
    for (const path of ["../secret.txt", "/etc/passwd", "C:\\secret.txt", "escape/secret.txt"]) {
      const result = await service.preview(path);
      assert.equal(result.type, "error");
      assert.ok(result.type === "error" && ["PATH_OUTSIDE_WORKSPACE", "SYMLINK_ESCAPE"].includes(result.code));
      assert.equal(result.type === "error" && result.message.includes(root), false);
      assert.equal(result.type === "error" && result.message.includes(outside), false);
    }
    service.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("bounds text, Markdown, JSON, and CSV descriptors", async () => {
  const { root, outside } = await fixture();
  try {
    await writeFile(join(root, "large.txt"), "0123456789");
    await writeFile(join(root, "data.json"), '{"ok":true,"items":[1,2]}');
    await writeFile(join(root, "bad.json"), "{bad");
    await writeFile(join(root, "data.csv"), "name,value\na,1\nb,2\nc,3\n");
    await writeFile(join(root, "bad.csv"), 'name,"unclosed\n');
    await writeFile(join(root, "quote-inside.csv"), 'name,va"lue\n');
    await writeFile(join(root, "quote-tail.csv"), 'name,"value"tail\n');
    const service = new PreviewService(root, identity, {
      limits: { maxTextBytes: 5, maxJsonBytes: 100, maxCsvBytes: 100, maxCsvRows: 2 },
    });
    const text = await service.preview("large.txt");
    assert.equal(text.type, "text");
    assert.ok(text.type === "text" && text.content === "01234" && text.truncated);
    const markdown = await service.preview("safe/readme.md");
    assert.equal(markdown.type, "markdown");
    assert.ok(markdown.type === "markdown" && markdown.renderer === "ui-primitives" && !markdown.policy.allowRawHtml && !markdown.policy.allowRemoteImages);
    const json = await service.preview("data.json");
    assert.equal(json.type, "json");
    assert.ok(json.type === "json" && (json.value as { ok: boolean }).ok);
    const invalidJson = await service.preview("bad.json");
    assert.deepEqual(invalidJson, { type: "error", code: "INVALID_JSON", message: "JSON content is invalid" });
    const csv = await service.preview("data.csv");
    assert.equal(csv.type, "csv");
    assert.ok(csv.type === "csv" && csv.rows.length === 2 && csv.truncated);
    const invalidCsv = await service.preview("bad.csv");
    assert.deepEqual(invalidCsv, { type: "error", code: "INVALID_CSV", message: "CSV contains an unclosed quote" });
    const quoteInside = await service.preview("quote-inside.csv");
    assert.equal(quoteInside.type, "error");
    assert.equal(quoteInside.type === "error" && quoteInside.code, "INVALID_CSV");
    const quoteTail = await service.preview("quote-tail.csv");
    assert.equal(quoteTail.type, "error");
    assert.equal(quoteTail.type === "error" && quoteTail.code, "INVALID_CSV");
    service.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("returns supported binary resources and local unsupported states", async () => {
  const { root, outside } = await fixture();
  try {
    await writeFile(join(root, "image.png"), Buffer.from([1, 2, 3]));
    await writeFile(join(root, "document.pdf"), Buffer.from("%PDF-1.7"));
    await writeFile(join(root, "unsafe.svg"), "<svg><script>alert(1)</script></svg>");
    await writeFile(join(root, "archive.zip"), Buffer.from([1, 2, 3]));
    const service = new PreviewService(root, identity, { resourceTtlMs: 100 });
    const image = await service.preview("image.png");
    assert.equal(image.type, "binary");
    assert.ok(image.type === "binary" && !image.resourceId.includes("image") && !image.resourceId.includes(root));
    const opened = await service.openResource((image as { resourceId: string }).resourceId, { identity, mediaType: "image/png" });
    assert.deepEqual([...opened.bytes], [1, 2, 3]);
    await assert.rejects(
      () => service.openResource((image as { resourceId: string }).resourceId, { identity: { ...identity, sessionId: "other" } }),
      (error) => error instanceof PreviewPanelError && error.code === "RESOURCE_UNAUTHORIZED",
    );
    const pdf = await service.preview("document.pdf");
    assert.equal(pdf.type, "binary");
    const svg = await service.preview("unsafe.svg");
    assert.deepEqual(svg, { type: "unsupported", path: "unsafe.svg", reason: "svg-sanitization-required", mediaType: "image/svg+xml" });
    const archive = await service.preview("archive.zip");
    assert.equal(archive.type, "unsupported");
    assert.equal(archive.type === "unsupported" && archive.reason, "unsupported-binary");
    service.dispose();
    await assert.rejects(
      () => service.openResource((image as { resourceId: string }).resourceId, { identity }),
      (error) => error instanceof PreviewPanelError && error.code === "RESOURCE_EXPIRED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("revalidates resource version, type, expiry, and replacement containment", async () => {
  const { root, outside } = await fixture();
  try {
    await writeFile(join(root, "image.png"), Buffer.from([1, 2, 3]));
    let now = 10;
    const service = new PreviewService(root, identity, { resourceTtlMs: 5, now: () => now });
    const image = await service.preview("image.png");
    assert.equal(image.type, "binary");
    assert.ok(image.type === "binary");
    await writeFile(join(root, "image.png"), Buffer.from([4, 5, 6, 7]));
    await assert.rejects(
      () => service.openResource(image.resourceId, { identity }),
      (error) => error instanceof PreviewPanelError && error.code === "RESOURCE_STALE",
    );
    const fresh = await service.preview("image.png");
    assert.equal(fresh.type, "binary");
    await rm(join(root, "image.png"));
    await symlink(join(outside, "secret.txt"), join(root, "image.png"));
    await assert.rejects(
      () => service.openResource((fresh as { resourceId: string }).resourceId, { identity }),
      (error) => error instanceof PreviewPanelError && error.code === "SYMLINK_ESCAPE",
    );
    const next = await service.preview("image.png");
    assert.equal(next.type, "error");
    await writeFile(join(root, "document.pdf"), Buffer.from("%PDF"));
    now = 100;
    const later = await service.preview("document.pdf");
    assert.equal(later.type, "binary");
    now = 200;
    await assert.rejects(
      () => service.openResource((later as { resourceId: string }).resourceId, { identity }),
      (error) => error instanceof PreviewPanelError && error.code === "RESOURCE_EXPIRED",
    );
    service.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("does not complete an opaque read after service disposal", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-preview-dispose-"));
  try {
    await writeFile(join(root, "image.png"), Buffer.alloc(4 * 1024 * 1024, 7));
    const service = new PreviewService(root, identity);
    const descriptor = await service.preview("image.png");
    assert.equal(descriptor.type, "binary");
    if (descriptor.type !== "binary") return;
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      () => service.openResource(descriptor.resourceId, { identity, signal: cancelled.signal }),
      (error) => error instanceof PreviewPanelError && error.code === "RESOURCE_EXPIRED",
    );
    const pending = service.openResource(descriptor.resourceId, { identity, mediaType: "image/png" });
    service.dispose();
    await assert.rejects(pending, (error) => error instanceof PreviewPanelError && error.code === "RESOURCE_EXPIRED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
