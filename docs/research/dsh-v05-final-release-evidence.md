# v0.5 governed Memory final packed release evidence

Issue: [#60](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/60)

This is the final v0.5 release record for Wayfinder #34. It supersedes the
historical implementation snapshot and supplements the installed-browser
evidence from [#55](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/55)
and [#59](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/59).

## Pinned identity

- Harness source: `deepseek-ai/deepseek-harness` at
  `47f943859bef60e4160492346772ded9b24f765a`.
- Harness/npm baseline: DSH packages `0.1.0-rc.6`, Cordis `4.0.1`, React
  `18.3.1`, TypeScript `6.0.3`, and Zod `4.4.3`.
- Plugin package: `dsh-workspace-plugin@0.2.0`.
- Runtime: Node `v22.23.2`, npm `10.9.8`.
- Profile lock SHA-256:
  `7db66e8384a3abab222525769c97fddf6bd30bbb18a76dd42d4d2c8e41feea2c`.
- Packed-consumer lock SHA-256:
  `bbb0b665c58bd395b6e5745aefb9eda2976d8269be7626a6aa8b266c9f590609`
  (deterministic digest with the disposable fixture root normalized).
- Compatibility-fixture tarball SHA-256:
  `6104fb01d2a77a0fcf523be5bd3e99551f63a413ed655388f7fbcc794a56fb01`.
- Installed browser tarball SHA-256:
  `1be38aab0c42344c3b8be3715483a853e38e1f9a44b03c326e9b539817821d5d`.
- Memory schema/migration version: `1`.
- Implementation commits: `ab7d56d` (governed release path) and `ee88763`
  (packed conflict preservation).

## Packed governance/security evidence

`npm run smoke:compat` installs the packed plugin in a clean rc.6 consumer and
invokes the generated Host/Typert boundary. The v0.5 fixture reports:

- exact duplicate idempotency (`duplicateIdempotent=true`);
- distinct provenance-reference merge on an exact duplicate
  (`provenanceMerged=true`);
- stale revision rejection (`CONFLICT`) and last-used increment;
- `verify → pin → unpin → stale → reverify → archive → restore → archive → forget`;
- expired verified Memory becomes stale and cannot be pinned (`INELIGIBLE`);
- same-title conflict preservation with explicit rejection;
- Shared Project write, governance, mark-used, archive, forget, and import
  rejection without acknowledgement (`UNAUTHORIZED`);
- export schema version `1`, invalid/oversized import rejection (`INVALID_SOURCE`),
  forgotten-content exclusion, ID-remapped active imports quarantined as
  unverified with import source references, and content-hash preservation;
- bad-hash/malformed quarantine, migration with `.bak`, unknown-schema and
  oversized read-only degradation, unavailable-root failure, and fresh-service
  persistence;
- zero Agent followup, model-request, or context-injection calls during all
  Memory operations.

The packed consumer also proves all four scopes and their retention policies,
same-session Workspace Root rebind failure, bounded post-restart retrieval, no
source fallback, generated Host/Client/Remote faces, no fixture-root or generic
Unix/Windows absolute paths in the packed envelope, and zero Agent/model/context
side effects.

## Installed browser evidence

The exact installed tarball above was installed into a disposable rc.6 `dsh web`
profile at `http://127.0.0.1:4178/` with a local mock provider. The run adopted
Workspace `4a7733d9-056a-4286-b4fd-2480d5411084` and created Session
`session-85306e49-2500-47c1-b6f8-46a4e6ebc151` through the official RPC. It
created a Project Memory record, verified and pinned/unpinned it, archived and
restored it, opened the Forget alertdialog, confirmed Cancel focus return, then
confirmed Forget and observed focus return to the Project scope control. It
switched to Shared Project and observed disabled Import/Create until the
explicit acknowledgement checkbox, then exported after acknowledgement.

The browser run captured HTTP 200 for `memoryOpen`, `memoryList`,
`memoryUpsert`, `memoryGovern`, `memoryExport`, and `artifactMetadata`; it had
one Memory region, zero alertdialogs after completion, no absolute path in the
rendered body, and an empty `agent-browser errors` report. The packed consumer
and browser run use different package archives by design: the former is the
disposable Typert compatibility fixture (`6104…`), while the latter is the
actual repository `npm pack` archive (`1be…`).

The historical #55/#59 evidence remains useful for the broader conflict/import
and shell scenario, but this current run is the browser binding for #60's
amended domain and packed artifact.

## Gates

- `npm test`: 115 passed, 0 failed.
- `npm run check`: passed.
- `npm run build`: passed.
- `npm pack --dry-run`: passed; 38 files, no source fallback.
- `npm run smoke:compat`: passed on the pinned baseline; compatibility fixture
  tar `6104…`, consumer lock `bbb0…`.
- `git diff --check`: passed.
- Installed browser/security evidence: passed against repository tar `1be…`.

## Release sequencing

After the reviewed `dev` commit and this evidence record are pushed, close
#60, append its context pointer to Wayfinder #34, and submit the final
`dev`→`main` PR. Do not merge that PR; human approval remains required.
