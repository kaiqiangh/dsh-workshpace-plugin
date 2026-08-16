# v0.3 mounted Workspace artifact browser evidence

Run date: 2026-08-16

This record closes the installed artifact-gate gap documented on Wayfinder
issues [#63](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/63) and
[#51](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/51) after the
Harness durable `write` result replay fix.

## Pinned identity

- Plugin source: `dev` commit `afcf9b4`
- Harness source: `47f943859bef60e4160492346772ded9b24f765a`
- Harness baseline: `@deepseek-ai/dsh@0.1.0-rc.6`
- Packed plugin: `dsh-workspace-plugin@0.2.0`
- Packed tar SHA-512: `8AIhZI1LF1SowZsjLxty01tFJZnox7fjG6SV9N/oTGK18CWLEbEd5uiezns5eUPS2twwVJ60r/d7ZGYjXcFQPQ==`

## Durable replay fix

The pinned Harness `write` tool emits `meta.diffs: []` for a newly created
file and places the authoritative `Created file` operation in the nested
tool-result content. The Host replay adapter now preserves that operation only
for first-party write tools, while update and missing-operation results remain
non-artifacts. Regression coverage includes create, update, and missing
operation envelopes.

## Installed Web run

The packed tar was installed into the official rc.6 Web profile and served at
`http://127.0.0.1:4173/`. A fresh Harness Session
`session-098635c8-d5b8-4afd-a0ac-dcf6f3474209` ran the public `write` tool and
created `browser-artifact-clean.md`.

- The Workspace artifact region displayed one session artifact: Markdown,
  17 B, available.
- The preview rendered `# Clean artifact` and showed path-free provenance with
  an opaque workspace-root identity.
- Direct `workspace/artifactMetadata` returned the artifact name, media type,
  size, source identity, preview state, and safe download name; no absolute
  host path was present.
- `agent-browser errors` was empty.
- The existing Files, Session, Changes, Context, and Memory regions remained
  visible in the same shell.

## Deterministic gates

`npm run check`, `npm test` (115/115), `npm run build`,
`npm run smoke:compat`, `git diff --check`, and `npm pack --dry-run` pass on
the source commit.
