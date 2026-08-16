# v0.5 governed Memory release-path evidence

Run date: 2026-08-16

This is the current release-path verification for the v0.5 governed Memory
surface. It supplements the historical implementation evidence without
rewriting its fixed-SHA record.

## Pinned identity

- Repository `dev` head: `77cac074cc6b885cf47353121fd2c85fbeafc7de`
- DeepSeek Harness source: `47f943859bef60e4160492346772ded9b24f765a`
- Harness baseline: `@deepseek-ai/dsh@0.1.0-rc.6`
- Profile lock SHA-256: `7db66e8384a3abab222525769c97fddf6bd30bbb18a76dd42d4d2c8e41feea2c`
- Packed-consumer lock SHA-256: `ac28236b8da60589de76c88d8735173cb799cc3b9c0621d8fdb0ce4973301989`
- Plugin package: `dsh-workspace-plugin@0.2.0`
- Final packed artifact: `dsh-workspace-plugin-0.2.0.tgz`, SHA-512
  `3UofG9Mq7TTJ+XineBsPmDx8ZtHKguBlJOY+kKYpmmwhCm42Y+D7FGbOPO3QQHwBI95kVRWXq861mVbN0JH8GwWQ==`

## Deterministic gates

The following commands pass on the pinned `dev` head:

```sh
npm run check
npm test                 # 111/111
npm run build
npm run smoke:compat
git diff --check
npm pack --dry-run
```

The compatibility smoke installs the exact rc.6 fixture, consumes the packed
plugin, exercises the generated Host/Client faces and lifecycle disposal, and
reports the pinned Harness source and package map. The final tar contains the
Host and browser Client bundles, generated declarations, the bundle patch, and
the tracked stylesheet; it contains no source-mode fallback.

## Installed Web acceptance

An official rc.6 profile was installed from the final tar and launched with a
local `dsh web` server at `http://127.0.0.1:4173/`. A real existing Harness
session was selected in Chrome through the Web shell.

- Workspace artifact and Memory RPCs, including `memoryUpsert` and
  `memoryGovern`, returned HTTP 200; no captured Workspace request returned
  4xx.
- The Memory surface rendered scope controls, provenance/hash/revision/
  retention metadata, the review-only no-injection notice, and local save
  recovery.
- Verify and Pin transitions completed locally and returned HTTP 200.
- Shared Project displayed its explicit write-acknowledgement checkbox and
  kept import/create disabled until acknowledgement.
- Forget rendered an `alertdialog` with labelled description, moved focus to
  the confirmation button, returned focus to the trigger on Cancel, and
  returned focus to the Project scope control after confirmed Forget.
- `agent-browser errors` was empty after the run.

## Release sequencing

This proves the v0.5 feature and installed browser gate. The final
`dev`-to-`main` PR remains intentionally deferred until every other open child
of Wayfinder map #34 is complete, as required by the repository workflow.
