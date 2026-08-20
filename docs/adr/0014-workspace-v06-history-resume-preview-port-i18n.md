# ADR 0014: v0.6 — history-resume fix, dsh-web-ui preview port, and full i18n

- **Status:** Accepted
- **Date:** 2026-08-17
- **Context:** The user asked to port the read-only essentials of dsh-web-ui
  (changes display + preview implementation) into this plugin, and to fix a
  reported bug: after reopening a historical (resumed) session, the chat
  summary card was missing and tab data appeared empty. Wayfinder research
  (tickets #110/#111) proved the root cause: the host appended a custom
  `workspace/summary` event via `session.append`, which the persistence layer
  stores but whose cold-read path (`assertEventsSupported`) rejects unknown
  non-ignorable types — so a restarted session whose log contains
  `workspace/summary` refuses to load entirely (`openState=error`, missing
  card + empty tabs). Verified on this machine: two historical session logs
  contained 51 and 127 `workspace/summary` events. The user also required all
  displayed copy to support English and Chinese.

## Decision

1. **Stop persisting `workspace/summary` entirely.** `attachWorkspaceSummaryEmitter`
   is now a no-op (API-compatible). The summary is derived on demand from
   allow-listed durable tool records (`tool/call` + `tool/result`) via the
   existing pure `workspaceSummaryFor` / new `workspaceSummaryWithMemory`, and
   exposed to the web client through a new `workspaceSummary` remote. This
   removes the out-of-vocabulary event from every new session log, so resumed
   sessions load normally (fold-once-at-resume, wayfinder #112).
2. **Summary card moves from the chat conversation node to the Workspace tab.**
   The old `conversation.chat.node` registration is removed (it was event-driven
   and could never render without a persisted event). A new read-only summary
   block renders at the top of the Workspace conversation tab, polling the
   `workspaceSummary` remote — identical for live and resumed sessions.
3. **Markdown previews render through a self-contained Workspace renderer**
   (GFM subset) instead of `MarkdownText`, because that primitive only renders
   absolute http(s) images. Relative images now resolve to same-origin opaque
   resource URLs (new `PreviewService.markdownImageUrl`), preserving ADR 0005
   (no host path in the query string). Remote images stay dropped.
4. **Mermaid fences render via a same-origin vendor bundle.** The mermaid IIFE
   is copied from the npm dependency into `lib/assets/` at build time (zero
   runtime npm dependency — ADR 0011) and served from `/workspace/vendor/mermaid.js`
   (size+mtime ETag, dsh-web-ui `serveVendorMermaid` pattern). The renderer
   emits mermaid fences with a `data-dsh-source` attribute; the client enhancer
   renders them and re-renders on shell theme flips.
5. **PDF previews stream with Range/ETag.** `/workspace/resource` now answers
   `206`/`416` for single byte ranges and `304` revalidation with an
   ETag derived from the resource version, switching `no-store` to `no-cache`.
   The 50 MiB `maxPdfBytes` Operational Budget ceiling is unchanged (ADR 0005).
6. **Read-only multi-tab preview inside Artifacts** (dsh-web-ui PreviewTabs
   pattern, minus editing): an ordered tab strip of open artifacts with
   per-tab descriptor caching, switch/close only. No editor, split, or save
   (read-only stance, ADR 0012/0013).
7. **SCM grouped display**: the Changes list renders staged / unstaged /
   untracked section headers (dsh-web-ui ScmPanel grouping) while keeping the
   filter chips and the ADR 0011 untracked "stage it to see a diff" notice.
   No stage/unstage/discard actions (read-only).
8. **Full English/Chinese i18n.** A zero-dependency dictionary
   (`workspace-i18n.ts`) with `t()` lookup covers every surface (Artifacts /
   Memory / Changes / preview / summary / view / remote error messages); the
   locale follows the browser language.

## Considered Options

- **Mark the custom event ignorable** — rejected: `Session.append` has no
  ignorable option (verified in dsh-session 0.1.0-rc.6); persistence accepts
  `ignorable: true` only on seed/replay paths the plugin cannot drive.
- **Keep `MarkdownText` and pre-render images to absolute URLs** — rejected:
  the primitive still drops non-http(s) srcs at render time; a self-contained
  renderer is the only zero-dependency way to show same-origin images.
- **CDN for mermaid** — rejected: breaks the local-first/privacy stance; the
  same-origin vendor bundle keeps ADR 0011's runtime zero-dependency.
- **Port `?root&path` raw routes** — rejected: ADR 0005 Opaque Resource forbids
  host paths in the query string; the opaque-id model is extended instead.

## Consequences

- New sessions no longer write `workspace/summary`; historical sessions
  created before v0.6 whose logs already contain the event remain unloadable
  by the DSH persistence layer (documented in README troubleshooting). There
  is no safe in-place rewrite of the stored log (seq continuity), so affected
  sessions are not recoverable.
- The `workspace/summary` type remains declared for type-level compatibility
  with pre-v0.6 logs, but is never appended.
- Bundle size grows by ~3.4 MB (mermaid.min.js, gzip ~800 KB) in `lib/assets/`.
- The chat summary card is replaced by the tab summary block; README and
  CONTEXT updated accordingly.
- Typert remote boundary types must be plain objects (no Map/symbol keys);
  markdown `imageUrls` is a plain record.
- **Out of scope:** SCM write operations, editable/split preview, syntax
  highlighting, in-diff search, native DSH Trajectory changes.
