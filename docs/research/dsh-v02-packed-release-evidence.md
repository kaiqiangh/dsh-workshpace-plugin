# DSH Workspace v0.2 packed-release evidence

This evidence applies to issue #41 and the pinned baseline declared by
ADR-0003 and ADR-0008.

## Baseline

- Harness source: `47f943859bef60e4160492346772ded9b24f765a`
- Repository: `https://github.com/deepseek-ai/deepseek-harness.git`
- Package versions: the exact `PACKAGE_VERSIONS` map in
  `scripts/dsh-compat-smoke.mjs`; the smoke verifies both profile and consumer
  lockfiles.

## Command and fixture

```sh
npm test
npm run check
npm run build
npm pack --dry-run
npm run smoke:compat
```

`npm run build` uses the committed disposable-workspace recipe in
`scripts/build.mjs` and emits the package's own `lib/` tree; `npm pack` then
proves that the advertised entrypoints are present in the repository tarball.
The generated workspace uses `strict: true` with ordinary declaration
emission; no `noCheck` or source-mode Typert fallback is enabled.
The compatibility smoke separately copies this repository's `src/`, `package.json`,
`package-lock.json`, and `cordis.patch.yml` into a disposable Harness-style
`packages/plugin` workspace. It builds Typert Host/Client/Remote artifacts,
emits TypeScript declarations, runs `npm pack`, installs that tarball into a
fresh consumer, and never imports the repository source from the consumer.

## Observed assertions

- Package metadata loads `dsh.bundle.patch`, `dsh.client.platform: "web"`,
  `immediately: true`, all public faces, and generated Typert artifacts.
- Generated runtime codecs resolve `zod` from the packed plugin's declared
  runtime dependencies; the consumer install does not add it separately.
- The tarball contains built JavaScript, declarations, the patch, and no
  `src/` fallback.
- The installed Host bundle invokes an Agent-scoped operation, reads zero
  capacity, replaces one bounded snapshot, and preserves strict Typert codecs.
- Pinned Context admits one item, replaces changed content, marks an
  over-budget update locally, and unregisters its public context carrier.
- The WebServer route authorizes the opaque session/root identity, bounds the
  response, rejects tampered identifiers/types, and rejects stale roots.
- The packed Client mounts the generated Remote contribution, fails closed when
  required conversation/Remote seams are missing, registers and replays the
  Workspace conversation node,
  exercises typed preview/Working Set/Pinned Context operations, and disposes
  all Remote, event, slot, WebServer, registry, and carrier registrations. Its
  browser artifact is wrapped as the official `window.__ModuleLoader__.load`
  factory and contains no top-level ESM imports/exports.
- An installed local profile was launched with `dsh web --host 127.0.0.1
  --port 0`, loaded the packed plugin, and was exercised in Chrome through the
  profile URL. The response was HTTP 200, the Harness rendered its normal New
  Session/Workspaces shell, and the browser recorded no console or page errors.

## Upgrade trigger

Re-run the research gates and update the pinned profile whenever Harness moves
the public Typert, Agent context, WebServer, conversation-node, bundle/client
metadata, or package export contracts. A floating prerelease range is not a
supported release input.
