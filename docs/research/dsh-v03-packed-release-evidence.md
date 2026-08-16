# v0.3 packed release-path evidence

Run date: 2026-08-16

This record resolves [Verify the v0.3 packed release path](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/52)
for the pinned DeepSeek Harness baseline.

## Pinned identity

- Plugin source: `dev` commit `3aad134`
- Harness source: `47f943859bef60e4160492346772ded9b24f765a`
- Harness baseline: `@deepseek-ai/dsh@0.1.0-rc.6`
- Plugin package: `dsh-workspace-plugin@0.2.0`
- Packed tar: 38 files, 101,296 bytes, SHA-256
  `688f179f6cddaa94dbdf8541cde7e5a5f27464a789716c44057f81e74115ff77`
- Profile lockfile (v3) SHA-256:
  `7db66e8384a3abab222525769c97fddf6bd30bbb18a76dd42d4d2c8e41feea2c`
- Packed-consumer lockfile (v3) SHA-256:
  `3d5774438a62d54601bda44e7d429c15d4632fa8196091acca99bf9604b899ad`
- Runtime: Node `v22.23.2`, npm `10.9.8`, pnpm `11.21.0`
- Exact resolved package versions: the `PACKAGE_VERSIONS` map in
  [`scripts/dsh-compat-smoke.mjs`](../../scripts/dsh-compat-smoke.mjs).

## Strict packed consumer

The disposable compatibility fixture installs the packed tar into a clean
consumer and asserts:

- built Host, Client, and Remote faces load from public package exports;
- strict generated descriptors expose the artifact and Memory methods;
- the packed client has no source files and no SRC-JSON fallback;
- public artifact view, preview, resource URL, and overlay registration load;
- the artifact overlay registers exactly once and disposes cleanly;
- a packed download controller cancels an in-flight `AbortSignal` request and
  settles as `cancelled`;
- the Host gateway serves an authorized opaque resource as HTTP 200 with the
  expected media type and safe attachment name;
- tampered resource ids, media types, and Workspace identities return HTTP 404;
- Fiber disposal removes the route and all conversation/overlay registrations.

## Installed Web gate

The real installed browser evidence is recorded in
[`dsh-v03-mounted-integration-evidence.md`](./dsh-v03-mounted-integration-evidence.md):
one first-party Produced row, one Workspace artifact surface, an opaque image
preview/download route, safe filename handling, keyboard focus, path-free
metadata, preserved shell regions, and empty browser errors.

## Deterministic gates

The current `dev` source passes `npm run check`, `npm test` (115/115),
`npm run build`, `npm run smoke:compat`, `git diff --check`, and
`npm pack --dry-run`.
