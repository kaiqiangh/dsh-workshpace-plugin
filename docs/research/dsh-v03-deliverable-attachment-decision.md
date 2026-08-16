# DSH Workspace v0.3 deliverable and attachment boundary

Decision record for issue #36. This decision is based on the PRD/ARD v0.3
scope and the pinned DeepSeek Harness revision
`47f943859bef60e4160492346772ded9b24f765a`, with first-party packages pinned
to `0.1.0-rc.6`.

## Decision

Workspace owns the artifact envelope, preview policy, opaque resource
authorization, and browser download flow. Harness UI packages are reused only
behind Workspace adapters; their renderers do not become the Workspace's trust
boundary or size policy.

- Reuse the public `MarkdownText`, `CodeBlock`, and `JsonTree` exports from
  `@deepseek-ai/dsh-client-ui-primitives` for bounded host-produced data.
- Keep CSV, image, PDF, and generic binary handling Workspace-owned. The
  current Harness package inventory has no public CSV/PDF/general-resource
  renderer that matches the Workspace contract.
- Keep Workspace session-wide artifact derivation independent of
  `@deepseek-ai/dsh-client-ui-deliverables`. Preserve the first-party
  turn-scoped produced-files row and do not register a duplicate row.
- Treat `@deepseek-ai/dsh-client-ui-attachment` as UI atoms for message
  attachments, not as Workspace file storage. Do not copy local Workspace files
  into attachment-local storage or fabricate attachment references.
- Downloads are browser actions backed by an opaque, session/workspace-bound
  Host/Web resource route. The browser never receives a raw host path; the
  route revalidates containment, type, size, expiry, and identity on every
  request. Cancellation is an `AbortSignal` at the browser boundary.

## Capability matrix

| Capability | Public Harness surface | v0.3 boundary and disposition |
| --- | --- | --- |
| Markdown | `dsh-client-ui-primitives` `MarkdownText` | Adapter reuses the renderer; Host caps bytes first, disables raw HTML, and documents remote-image policy. |
| Code/text | `CodeBlock` (known grammars with plain fallback) | Adapter reuses highlighting; Host owns UTF-8 bounds, truncation, and language hint. Plain text uses a native escaped `<pre>`. |
| JSON | `JsonTree` / `JsonBlock` | Host caps bytes and structural complexity before parsing; invalid JSON becomes a bounded text/error state. Renderer limits never replace Host limits. |
| CSV | No supported first-party CSV renderer/parser | Workspace bounded parser/table, max bytes and rows, delimiter/error state, and scrollable accessible table. |
| Image | `dsh-client-ui-attachment` image atoms require attachment refs and an authorized URL loader | Workspace uses its own opaque resource URL and native `<img>` with alt text; no attachment-store copy. SVG requires an explicit safe policy and is unsupported by default. |
| PDF | No supported first-party PDF viewer in the pinned client inventory | Browser PDF viewer over the Workspace resource route, within the same Host size and authorization limits. |
| Generic binary | Attachment read APIs are image/session-log scoped and base64 buffered; no reusable arbitrary-file route | Workspace-owned opaque resource route with bounded streaming where the public Host/Web carrier permits it; otherwise show metadata and an unsupported/download-only state. |
| Deliverable row | `dsh-client-ui-deliverables` `ProducedFiles` is turn-scoped and mutation-location based | Keep the first-party row. Workspace artifacts remain session-wide and include indirectly-created previewable files; clicks open Workspace preview/download. |
| Export/download | No general reusable Workspace export API in the pinned public surface | Browser-triggered download backed by the Host/Web resource route; safe filename, cancellation, stale-resource, and failure states are Workspace-owned. |

The detailed package/API audit is recorded in
[`dsh-preview-reuse-audit.md`](./dsh-preview-reuse-audit.md), including the
public exports, attachment limitations, package dist-tag warning, and source
links.

## Artifact and resource envelope

The v0.3 implementation must keep a stable metadata envelope separate from
bytes:

```ts
type WorkspaceDeliverable = {
  id: string;                         // opaque, non-path identifier
  name: string;                       // display name only
  mediaType: string;                  // normalized MIME type
  sizeBytes: number;
  source: { sessionId: string; workspaceId: string; kind: "artifact" | "file" };
  preview: "available" | "unsupported" | "oversized" | "stale";
  resourceId?: string;                // only when a bounded read is authorized
  downloadName: string;               // sanitized basename, never a path
  altText?: string;                    // required for image previews
};
```

The Host applies the PRD/ARD limits before reading or parsing: text 2 MiB,
JSON 5 MiB, CSV 10 MiB/1,000 rows, image 20 MiB, and PDF 50 MiB unless the
resolved Workspace config overrides them within safe bounds. It returns typed
unsupported/oversized/stale errors rather than partial unbounded bytes.

Security and accessibility requirements:

- Normalize and contain every requested Workspace path; bind resource IDs to
  session, Workspace identity, and a revalidated file version.
- Never expose a host filesystem path, local file URL, or arbitrary HTML to the
  browser. All previews receive typed data or an opaque resource response.
- Sanitize download names to a single safe basename and reject control
  characters, traversal, and ambiguous extensions.
- Use semantic table headers, keyboard-operable preview/download controls,
  visible focus, and meaningful image alt text. PDF and unsupported binary
  states must explain what the user can do next.

## Thin vertical-slice acceptance outline

The v0.3 implementation is ready only when the packed consumer and installed
Web profile demonstrate all of the following:

1. A session-created Markdown/code/JSON artifact renders through the public
   Harness adapter after Host byte/parse limits are enforced.
2. A bounded CSV renders as an accessible table; malformed, oversized, and
   row-limited inputs remain typed local states.
3. An image and PDF are fetched through an opaque Workspace resource ID; a
   tampered ID, stale version, wrong media type, or over-limit resource is
   rejected without leaking a host path.
4. A generic binary file is either downloaded through the same authorized
   route or presents an explicit unsupported state; it is never silently
   treated as a message attachment.
5. Browser download cancellation, safe filename handling, keyboard access,
   and cleanup of resource/slot registrations are covered by tests.
6. The first-party Produced Files row remains present exactly once, while the
   Workspace artifact list remains session-wide and includes indirect file
   creation evidence.

## Rejected alternatives and upgrade trigger

- Importing private Harness component paths or internal attachment stores is
  rejected because those APIs are not a stable third-party contract.
- Treating `ProducedFiles` as the Workspace artifact index is rejected because
  its evidence is turn-scoped and excludes indirect terminal-created files.
- Sending raw bytes or paths through a JSON RPC response is rejected for
  memory, leakage, and cancellation reasons.
- Floating package ranges are rejected. Re-run the audit and update adapters
  when Harness changes the public UI primitive exports, attachment/resource
  authorization, WebServer/Typert carrier, or deliverables contract.
