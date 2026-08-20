# Workspace artifact kinds and real session delivery

Research for [issue #132](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/132), inspected at commit `83af760efc73ae87039ae443d929f65b23282abb` on 2026-08-20. This is a finding only; no product code was changed.

## Verdict

The real path works for a directly-created file when the durable Harness session contains the paired `tool/call` and `tool/result` records:

```text
agent.session.events
  -> sessionToolRecords()
  -> SessionActivityObserver.resume()
  -> deriveArtifacts()
  -> WorkspaceArtifactCarrier.metadata()
  -> WorkspaceDeliverable[]
  -> Typert workspace/artifactMetadata
  -> client resolveRemote(sessionId)
  -> artifact list + previewArtifact(id)
  -> browser renderer / opaque resource route
```

The carrier is session-derived, not a separate artifact database. The Host reads `agent.session.events`, pairs durable calls/results, and reconstructs a projection on each metadata refresh; the carrier then stats the current file, previews it, and creates path-free metadata. [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L130-L170) [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L221-L307) [`index.ts`](../src/index.ts#L195-L212)

The important boundary is narrower than the PRD wording: an artifact is only a file that is still present, created in this session, and marked previewable. Deleted files disappear from the current list, and non-previewable extensions are filtered before `WorkspaceDeliverable` creation. [`activity.ts`](../src/domain/activity.ts#L142-L153) [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L243-L271) The existing e2e fixture proves the full durable-to-list path, including strict bridge parsing and a rendered artifact `<li>`. [`workspace-artifacts-e2e.test.ts`](../tests/workspace-artifacts-e2e.test.ts#L30-L80)

## Delivered kinds

| Input / state | Host descriptor and metadata | Browser presentation | Finding |
|---|---|---|---|
| Code / plain text | Any non-special extension becomes `type: "text"`; a small extension map supplies the optional language. `WorkspaceDeliverable.mediaType` is `text/plain` for this family. Text is bounded and can return `truncated: true`. [`preview.ts`](../src/domain/preview.ts#L203-L220) [`preview.ts`](../src/domain/preview.ts#L384-L408) [`deliverable.ts`](../src/domain/deliverable.ts#L80-L87) | `CodeBlock` through the public primitive seam. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L112-L120) | Delivered. There is no separate code MIME kind; grouping is effectively filename/media-type presentation. |
| Markdown | `.md` becomes `type: "markdown"`, `text/markdown`, bounded content, and a policy with raw HTML and remote images disabled. Relative image URLs may be added as opaque same-origin resources. [`preview.ts`](../src/domain/preview.ts#L83-L100) [`preview.ts`](../src/domain/preview.ts#L394-L405) [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L274-L295) | A zero-dependency bounded Markdown renderer supports headings, lists, tables, links, images, and fenced code. Mermaid fences are enhanced through `/workspace/vendor/mermaid.js`; failed enhancement leaves readable source. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L120-L139) [`workspace-markdown.ts`](../src/web/workspace-markdown.ts#L219-L255) [`workspace-mermaid.ts`](../src/web/workspace-mermaid.ts#L88-L128) | Delivered. Current tests prove Markdown, safety filtering, relative-image resolution, and Mermaid fence preservation. [`workspace-markdown.test.ts`](../tests/workspace-markdown.test.ts#L6-L26) [`preview.test.ts`](../tests/preview.test.ts#L178-L198) |
| JSON | `.json` is parsed into a bounded JSON value; malformed JSON returns `INVALID_JSON`. [`preview.ts`](../src/domain/preview.ts#L572-L584) | `JsonTree`, expanded at the top level and marked copyable. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L141-L145) [`preview-adapters.test.ts`](../tests/preview-adapters.test.ts#L18-L39) | Delivered for valid JSON. Invalid JSON reaches the carrier as an error descriptor, not a raw fallback. |
| CSV | `.csv` is parsed into columns/rows with bounded bytes, rows, columns, cell size, quoting, and explicit truncation; malformed CSV returns `INVALID_CSV`. [`preview.ts`](../src/domain/preview.ts#L320-L360) [`preview.ts`](../src/domain/preview.ts#L586-L592) | Accessible horizontally-scrollable table with a truncation caption. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L74-L86) [`preview-adapters.test.ts`](../tests/preview-adapters.test.ts#L41-L48) | Delivered for valid CSV. |
| Images | PNG, JPEG, WebP, and GIF become `type: "binary"` with `mediaType`, opaque `resourceId`, version, and expiry. [`preview.ts`](../src/domain/preview.ts#L25-L32) [`preview.ts`](../src/domain/preview.ts#L384-L393) [`preview.ts`](../src/domain/preview.ts#L549-L570) | `<img>` points at `/workspace/resource?id=...&type=...`; `alt` comes from safe artifact metadata. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L146-L151) | Delivered. Current tests prove opaque identity, type checks, and resource opening. [`preview-adapters.test.ts`](../tests/preview-adapters.test.ts#L49-L51) [`preview.test.ts`](../tests/preview.test.ts#L81-L109) |
| PDF | `.pdf` uses the same binary descriptor and opaque route, with the PDF-specific size budget. [`preview.ts`](../src/domain/preview.ts#L14-L23) [`preview.ts`](../src/domain/preview.ts#L549-L554) | `<iframe>` over the same-origin resource URL; the Host route also supports ETag and single byte ranges for the browser viewer. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L146-L151) [`workspace-resource.ts`](../src/host/workspace-resource.ts#L179-L217) | Delivered by the source path and browser adapter; the current bounded tests prove the descriptor/iframe shape, while historical mounted evidence proves a live PNG resource/download path, not a live PDF run. [`preview-adapters.test.ts`](../tests/preview-adapters.test.ts#L49-L54) [`dsh-v03-mounted-integration-evidence.md`](../docs/research/dsh-v03-mounted-integration-evidence.md#L22-L45) |
| Binary download | Generic binary descriptors render as a download link when a resource exists; `WorkspaceDeliverable` carries a safe `downloadName` and never carries bytes. [`deliverable.ts`](../src/domain/deliverable.ts#L15-L27) [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L146-L151) | Download uses the same opaque resource route and maps HTTP 404/410 to stale, 413 to oversized, cancellation to cancelled. [`workspace-deliverables.ts`](../src/web/workspace-deliverables.ts#L164-L207) | The route/download primitive is delivered, but generic binary files do not become carrier artifacts under the current derivation filter below. |

## Declared kinds that do not reach the Workspace artifact list

The public preview union and generated Typert codec declare seven result variants: `text`, `markdown`, `json`, `csv`, `binary`, `unsupported`, and `error`. The generated `previewArtifact` result schema accepts all seven, and the `artifactMetadata` schema preserves metadata fields such as source identity, preview state, resource id, safe name, alt text, and mtime. [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L12-L86) [`typert.remote-client.js`](../lib/typert.remote-client.js#L651-L695) [`typert.remote-client.js`](../lib/typert.remote-client.js#L716-L742) The bounded bridge check parsed all seven variants successfully on this branch.

The delivered artifact list is narrower:

1. `observation.ts` marks `.svg` and generic binary extensions as `previewable: false`. [`observation.ts`](../src/domain/observation.ts#L76-L82) [`observation.ts`](../src/domain/observation.ts#L164-L194)
2. `deriveArtifacts()` requires `previewable` and current `present` state, so those files never reach `WorkspaceArtifactCarrier.metadata()`. [`activity.ts`](../src/domain/activity.ts#L142-L153)
3. `PreviewService` can still independently return `unsupported` for SVG sanitization or generic binary, and the browser renderer can independently render an unsupported status. [`preview.ts`](../src/domain/preview.ts#L384-L393) [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L112-L118) But there is no real durable-session-to-artifact-list evidence that those unsupported files are listed as metadata-only artifacts.

This matches the current UI copy, which explicitly says deleted or non-previewable files are not listed. [`workspace-i18n.ts`](../src/web/workspace-i18n.ts#L320-L348) It does not match the broader PRD acceptance sentence that unsupported files should show metadata and a clear unsupported-preview state. [`DSH_Workspace_PRD.md`](../docs/DSH_Workspace_PRD.md#L411-L415) That is the main declared-versus-delivered gap for v0.8.

## Oversized, stale, and error states

| State | Actual Host behavior | Actual Web behavior | Gap / consequence |
|---|---|---|---|
| Oversized text/Markdown | Text/Markdown is read up to the text limit and remains `available` with `truncated: true`; it is not converted to `oversized`. [`preview.ts`](../src/domain/preview.ts#L396-L407) | The renderer adds a truncation status note. [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L102-L109) | Correct but important: “too large” means “truncated” for text, not the metadata chip `Too large to preview`. |
| Oversized JSON/CSV/image/PDF | These providers return `FILE_TOO_LARGE`; `createWorkspaceDeliverable()` maps that to metadata state `oversized`. [`preview.ts`](../src/domain/preview.ts#L549-L555) [`preview.ts`](../src/domain/preview.ts#L572-L592) [`deliverable.ts`](../src/domain/deliverable.ts#L72-L77) | Detail state maps `FILE_TOO_LARGE` to `oversized`; no resource id means no download control. [`workspace-deliverables.ts`](../src/web/workspace-deliverables.ts#L107-L135) [`workspace-artifact-surface.ts`](../src/web/workspace-artifact-surface.ts#L475-L485) | Delivered as a bounded local state. |
| Stale / expired opaque resource | Open revalidates identity, media type, file version, size, and TTL; stale/expired resources throw typed errors. The HTTP route maps stale/expired to 410. [`preview.ts`](../src/domain/preview.ts#L495-L523) [`workspace-resource.ts`](../src/host/workspace-resource.ts#L104-L109) | Typed detail maps `RESOURCE_STALE` to `stale`; download maps 404/410 to `stale`. [`workspace-deliverables.ts`](../src/web/workspace-deliverables.ts#L107-L135) [`workspace-deliverables.ts`](../src/web/workspace-deliverables.ts#L164-L167) | The main image/PDF path is weaker: `WorkspaceArtifactCarrier.previewArtifact()` returns the cached binary descriptor without opening the resource, and the renderer uses bare `<img>`/`<iframe>` with no explicit stale/error callback. [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L274-L280) [`workspace-preview-adapters.ts`](../src/web/workspace-preview-adapters.ts#L146-L151) A changed file can therefore surface as a browser resource failure until the 5-second metadata refresh, rather than a local “stale” message. |
| Invalid / provider error | `PreviewErrorCode` covers path, containment, missing, permission, size, parse, resource, unsupported, and provider failures. Invalid JSON/CSV are returned as typed error descriptors; unknown artifact ids return `RESOURCE_INVALID`. [`preview.ts`](../src/domain/preview.ts#L43-L56) [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L274-L280) | A selected error descriptor becomes a local status message; missing remote/session degrades the surface, while an empty `[]` is a real empty state. [`workspace-artifact-surface.ts`](../src/web/workspace-artifact-surface.ts#L198-L252) [`workspace-artifacts-e2e.test.ts`](../tests/workspace-artifacts-e2e.test.ts#L92-L123) | Invalid parse errors are represented as metadata `preview: "unsupported"` by the deliverable mapper, but detail rendering sees the original error and reports status `error`. [`deliverable.ts`](../src/domain/deliverable.ts#L72-L77) [`workspace-deliverables.ts`](../src/web/workspace-deliverables.ts#L107-L135) The row/detail vocabulary is therefore not fully consistent. |
| Deleted / moved artifact | Metadata stats the current path each refresh and drops an artifact if it is gone or moved. [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L243-L271) | The e2e test observes list size `1 -> 0` after deletion. [`workspace-artifacts-e2e.test.ts`](../tests/workspace-artifacts-e2e.test.ts#L82-L90) | Delivered and intentionally not shown as a stale artifact. |

## Session evidence limitations

The durable adapter only constructs records from `tool/call` and `tool/result`, using nested `source.callId` / `toolCallId`, the paired call name/arguments, `meta`, and write-result prose (`Created file` versus `Updated file`). [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L112-L170) A successful create is then classified as `CREATED`; an update is not a new artifact, and a missing operation or non-write prose is rejected by the existing tests. [`workspace-artifacts.test.ts`](../tests/workspace-artifacts.test.ts#L41-L135)

The current carrier does not apply the separate reconciliation snapshots supported by `SessionActivityObserver`; its `records` callback supplies only `NativeDurableToolRecord[]`. [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L88-L93) [`workspace-artifacts.ts`](../src/host/workspace-artifacts.ts#L304-L307) Therefore direct first-party write evidence is proven, but indirect shell-created/deleted/renamed files are not proven to reach this artifact carrier. The repository's observation research already identifies shell paths and indirect outputs as requiring Git/filesystem reconciliation rather than `tools/result` alone. [`dsh-observation-continuation-contracts.md`](../docs/research/dsh-observation-continuation-contracts.md#L35-L39) This is a real delivery gap if v0.8 intends “session-created” to include shell/terminal side effects.

## Remote and browser confirmation

The Client contribution resolves the active session id, obtains the mounted `remote.workspace` namespace, and calls `artifactMetadata` / `previewArtifact` with that session id. [`client.ts`](../src/client.ts#L93-L124) The browser surface validates metadata, groups it as Documents / Data / Images / Other, polls every five seconds, opens up to eight preview tabs, and renders a selected descriptor with the shared preview adapters. [`workspace-artifact-surface.ts`](../src/web/workspace-artifact-surface.ts#L99-L124) [`workspace-artifact-surface.ts`](../src/web/workspace-artifact-surface.ts#L198-L252) [`workspace-artifact-surface.ts`](../src/web/workspace-artifact-surface.ts#L534-L574)

Current bounded verification:

- `node --experimental-strip-types --test tests/preview.test.ts tests/workspace-artifacts.test.ts tests/workspace-artifacts-e2e.test.ts tests/deliverable.test.ts tests/workspace-deliverables.test.ts tests/workspace-markdown.test.ts tests/preview-adapters.test.ts`: **35 passed, 0 failed**.
- `npm run check`: **36 source files OK**.
- The generated `previewArtifact` strict schema parsed every declared variant: **text, markdown, json, csv, binary, unsupported, error**.
- `npm run smoke:compat`: **blocked before the smoke body** by npm peer resolution: installed transitive `@deepseek-ai/dsh-commands@0.1.0-rc.8` requires `@deepseek-ai/dsh-agent@^0.1.0-rc.8` while the pinned fixture requests rc.6. This is an environment/dependency-baseline blocker, not a product assertion failure.

Historical mounted evidence is narrower but real: a pinned rc.6 Web run displayed one Markdown artifact and a separate mounted run displayed one `image/png` artifact, fetched an opaque resource with HTTP 200, and downloaded it through `download=1` without exposing an absolute host path. [`dsh-v03-artifact-browser-evidence.md`](../docs/research/dsh-v03-artifact-browser-evidence.md#L29-L45) [`dsh-v03-mounted-integration-evidence.md`](../docs/research/dsh-v03-mounted-integration-evidence.md#L22-L45)

## v0.8 decision

Use four user-facing capability groups, with state badges inside each group:

1. **Readable:** code/plain text and Markdown (show `truncated` distinctly).
2. **Structured:** JSON and CSV (show parse errors locally).
3. **Media:** image and PDF (show opaque-resource freshness/error states).
4. **Download-only / unsupported:** metadata-only entries if v0.8 chooses to expose created-but-non-previewable files.

The decision that remains before redesign is whether to keep the current strict definition—only present, previewable artifacts—or widen the carrier to emit metadata-only unsupported entries. Do not infer “unsupported” from the bridge union alone: the union is declared, but the current durable-to-list path filters those files before the carrier. Also decide whether stale image/PDF failures should be converted into typed preview state on the Host or handled by explicit browser resource error UI.
