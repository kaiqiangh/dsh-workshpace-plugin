# v0.4 Project Memory packed release evidence

Issue: [#56](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/56)

## Release identity

- Harness source: `deepseek-ai/deepseek-harness`, pinned revision `47f943859bef60e4160492346772ded9b24f765a`.
- Plugin package: `dsh-workspace-plugin@0.2.0`.
- Compatibility baseline: all DSH packages at `0.1.0-rc.6` (Cordis `4.0.1`, React `18.3.1`, TypeScript `6.0.3`, Zod `4.4.3`); the authoritative set is `package.json` and the generated consumer lockfile.
- Runtime: Node `v22.23.2`, npm `10.9.8`.
- Profile lockfile SHA-256: `7db66e8384a3abab222525769c97fddf6bd30bbb18a76dd42d4d2c8e41feea2c`.
- Packed-consumer lockfile SHA-256: `df75e7293e5c7218f0c80e0acc8e7a0798cae64cca74ec15a5354e099412bc52` (deterministic digest with the disposable fixture root normalized).
- Packed tarball SHA-256: `ea4543b49061f26231125be613c46334936eef02e712971bc6e4262afd106eb5`.
- Memory schema/migration version: `1` (`MEMORY_SCHEMA_VERSION`).

## Packed consumer and gateway evidence

`npm run smoke:compat` built and installed the packed tarball, then invoked the public Typert gateway through the packed Host bundle. The fixture proved:

- `./client`, `./typert`, `./client/typert`, and `./remote` exports load from the tarball; generated Host/Client faces and Remote descriptors are present; no `src/` files are packed.
- Session, Project, User, and explicitly acknowledged Shared Project scopes each write and read their own record. A second agent rooted at a different Workspace Root sees zero Project records.
- Project Memory survives `memoryClose`/`memoryOpen` and a fresh packed `WorkspaceService` lifecycle; search is bounded to one result and preserves provenance; export/import marks imported records with `provenance.kind=import`.
- A bad-hash and malformed JSONL line are quarantined while the valid record remains readable (`BAD_HASH`, `CORRUPT_RECORD`). A known schema `0→1` migration succeeds and leaves a `.bak`; unknown-schema and oversized stores open read-only; an unavailable Project Root fails closed with `PROJECT_UNAVAILABLE`.
- Rebinding the same Session to another Workspace Root fails closed. Memory RPCs leave Agent followup, model request, and context injection counters at zero (`agentWakeups=0`, `modelRequests=0`, `contextInjections=0`).

The smoke result reported `scopes=[session, project, user, shared-project]`, `corruptionWarnings=[BAD_HASH, CORRUPT_RECORD]`, `migrationSchema=1`, `unknownSchemaReadOnly=true`, `oversizedReadOnly=true`, and the zero-injection counters above. All fixture files lived below disposable temporary roots; no host paths were returned in the browser envelope.

## Browser evidence

The installed `dsh web` metadata/CRUD/error/accessibility and privacy flow is recorded by prerequisite [#55](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/55), including clean-profile persistence, scope filtering, governance, Forget tombstones/focus return, Shared Project acknowledgement, and export HTTP 200. This ticket reuses that browser baseline and adds the packed release-path assertions above.

## Gates

- `npm test`: 115 passed, 0 failed.
- `npm run check`: passed.
- `npm run build`: passed.
- `npm pack --dry-run`: passed; 38 files, no source fallback.
- `npm run smoke:compat`: passed on the pinned baseline.
- `git diff --check`: passed.

Implementation commit is recorded in the issue closure comment after the reviewed `dev` commit is pushed.
