import assert from "node:assert/strict";
import test from "node:test";

import {
  workspaceArtifactPreviewDescriptor,
  workspaceArtifactResourceUrl,
} from "../src/web/workspace-artifact-surface.ts";

const artifact = {
  id: "workspace:artifact",
  name: "report.md",
  mediaType: "text/markdown",
  sizeBytes: 12,
  source: { sessionId: "session-1", workspaceId: "root-1", kind: "artifact" as const },
  preview: "available" as const,
  resourceId: "resource-1",
  version: "12:1:1:1",
  downloadName: "report.md",
};

test("adapts path-free preview data with a display-only path", () => {
  const descriptor = workspaceArtifactPreviewDescriptor(artifact, {
    type: "markdown",
    renderer: "ui-primitives",
    content: "# Report",
    truncated: false,
    policy: { allowRawHtml: false, allowRemoteImages: false, allowedLinkSchemes: ["http", "https", "mailto"] },
  });
  assert.equal(descriptor.path, "report.md");
  assert.equal(JSON.stringify(descriptor).includes("/Users/"), false);
});

test("builds only the relative opaque resource URL", () => {
  assert.equal(workspaceArtifactResourceUrl(artifact), "/workspace/resource?id=resource-1&type=text%2Fmarkdown&download=1");
});
