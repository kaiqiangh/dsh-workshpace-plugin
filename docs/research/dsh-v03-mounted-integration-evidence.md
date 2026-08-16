# v0.3 mounted Workspace integration evidence

Run date: 2026-08-16

This record resolves the installed integration gate for [Integrate and verify
v0.3 mounted deliverable surface](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/51).

## Pinned identity

- Plugin source: `dev` at `eee47c4`
- Harness source: `47f943859bef60e4160492346772ded9b24f765a`
- Harness baseline: `@deepseek-ai/dsh@0.1.0-rc.6`
- Packed plugin: `dsh-workspace-plugin@0.2.0`
- Packed tar SHA-256: `688f179f6cddaa94dbdf8541cde7e5a5f27464a789716c44057f81e74115ff77`
- Profile lockfile (v3) SHA-256: `7db66e8384a3abab222525769c97fddf6bd30bbb18a76dd42d4d2c8e41feea2c`
- Packed-consumer lockfile (v3) SHA-256: `dda7633430b751f63741df934a30c61e3a5fb1eb25c0f7049b502321e76217ec`
- Runtime: Node `v22.23.2`, npm `10.9.8`, pnpm `11.21.0`
- Exact resolved package versions: the `PACKAGE_VERSIONS` map in
  [`scripts/dsh-compat-smoke.mjs`](../../scripts/dsh-compat-smoke.mjs),
  exercised by the run below.

## Installed Web run

The packed plugin was installed into the pinned rc.6 Web profile and served at
`http://127.0.0.1:4175/`. Fresh Session
`session-7b5f9956-965d-418f-913e-6d6d55908344` ran the public `write` tool and
created `browser-image.png`.

- The chat showed exactly one first-party `Produced` row for the tool result.
- The mounted Workspace artifact surface appeared exactly once and listed one
  `image/png` artifact with typed metadata and provenance.
- The preview requested an opaque relative resource URL and returned HTTP 200.
- The Download control fetched the same opaque resource with `download=1` and
  returned HTTP 200; the Save download link used the safe name
  `browser-image.png` and the saved file was 16 bytes.
- The direct `workspace/artifactMetadata` response contained the artifact id,
  safe name, media type, size, version, session/root identity, preview state,
  resource id, and alt text; it contained no absolute host path.
- Keyboard focus moved from the artifact control to Download with the browser's
  visible `outline: auto` focus indication. Focus return on the surrounding
  Workspace drawer close remains covered by the existing
  `keeps selections while closing and returns focus to the opener` test.
- The existing Files, Session, Changes, Context, and Memory regions remained
  available. No `/private/` or `/Users/` path appeared in the browser envelope.
- `agent-browser errors` was empty.

## Deterministic gates

The current `dev` source passes `npm run check`, `npm test` (115/115),
`npm run build`, `npm run smoke:compat`, `git diff --check`, and
`npm pack --dry-run`.
