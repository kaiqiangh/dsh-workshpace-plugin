# v0.4/v0.5 installed Workspace Memory evidence

Run date: 2026-08-16

This record resolves [Implement v0.4 Memory inspection Web UX](https://github.com/kaiqiangh/dsh-workshpace-plugin/issues/55)
against the installed public Harness profile. The run used a disposable local
Workspace Root and a local `@deepseek-ai/dsh-llm-mock-server@0.1.0-rc.6`; no
real provider credential or absolute filesystem path was exposed to the
browser.

## Pinned identity

- Plugin source: `dev` commit `69c81e8`
- Harness source: `47f943859bef60e4160492346772ded9b24f765a`
- Harness baseline: `@deepseek-ai/dsh@0.1.0-rc.6`
- Plugin package: `dsh-workspace-plugin@0.2.0`
- Packed tar: 38 files, SHA-256
  `688f179f6cddaa94dbdf8541cde7e5a5f27464a789716c44057f81e74115ff77`
- Installed Web profile pnpm lockfile (v9) SHA-256:
  `6323d6093a2dc4c8f9f11c05399ae57bd131b702b3bb80ea64577ab4d9304bfe`
- Runtime: Node `v22.23.2`, npm `10.9.8`, pnpm `11.21.0`

## Installed Web acceptance

The packed plugin was installed into a clean `dsh web` profile on
`http://127.0.0.1:4176/`. Harness created the opaque Workspace identity
`2465fd32-d352-404f-a7e0-2f464df560f1` and Harness Session
`session-02a3043f-d04b-414a-b7b7-874df4105244`.

The mounted surface contains exactly one `Workspace Memory` region beside
exactly one `Workspace artifacts` region. The existing New Session, Session
hierarchy, Session log, Chat, and Trajectory shell controls remain present.
The browser body contained no `/tmp/` or `/Users/` absolute filesystem path.

The run exercised the following visible behavior:

- create a Project fact, select/open it, search it, and render title, type,
  scope, provenance, hash, verification, retention, revision, source, and
  last-used metadata;
- verify, pin/unpin, archive/restore, edit (which marks the record stale), and
  re-verify;
- open the Forget confirmation as an alert dialog, confirm focus returns to
  the Forget trigger on cancel, then forget the record and inspect its retained
  forgotten tombstone;
- switch to Shared Project and verify that Import/Create remain disabled until
  the explicit write acknowledgement is checked;
- export Shared Project Memory with `sharedWriteAcknowledged: true` and receive
  HTTP 200.

A second clean profile run on `http://127.0.0.1:4177/` exercised the remaining
governance paths against the same packed tar: the type filter sent a typed
`options.type: "decision"` request and then restored `fact`; a downloaded
export was edited into a bounded import, which returned HTTP 200 as an
unverified imported record with a source reference; the duplicate title/type
was rendered in a side-by-side Conflict comparison; `Keep this version`
completed the explicit resolution with two HTTP-200 governance transitions;
and the confirmed Forget path returned focus to the `Project` scope button.

The interaction network contained HTTP 200 responses for the Memory and
metadata requests, including `memoryOpen`, `memoryList`, `memorySearch`,
`memoryUpsert`, `memoryGovern`, `memoryExport`, and `artifactMetadata`. Memory
controls caused no Agent, followup, or model request; the only matching shell
traffic was boot-time `agentPreset.list` and `session.models`. The surface
reports that Memory never injects records into Agent context.

Each browser request used the installed generated Remote envelope
(`type: "client-request"`) with the typed `workspace/memory*` method name and
agent-scoped argument shape. The pinned packed-consumer smoke separately
validates the generated Host/Client/Remote descriptors and Memory methods.

Final browser checks were clean: zero page/console errors, one Memory region,
one artifact region, zero open alert dialogs, and no absolute filesystem paths
in the rendered body. The Web and mock-provider processes were stopped after
the run; no disposable `dsh web` or mock process remained.

## Deterministic and shell coverage

The installed run exercises the supported Memory carrier, successful browser
round trips, conflict/import recovery, and governance focus. The deterministic
115-test suite supplies the bounded failure and recovery paths that require
fixtures rather than a visible
record: optimistic write conflicts, import quarantine and malformed/bad-hash
input, migration/read-only stores, oversized/unavailable stores, isolated
scopes, and duplicate-title recovery (tests 45–59). Existing Workspace drawer
tests cover Files/Session/Changes tab selection and keyboard/focus behavior
(tests 101–105); the empty acceptance Session had no file/change rows to open,
so no Files/Session/Changes row was mutated or hidden by the additive Memory
region.
The Forget implementation returns focus to the Project scope control after a
confirmed Forget, and the alert-dialog focus/cancel path was observed in the
browser run.

The exact resolved package-version map and the packed-consumer v3 lock SHA are
recorded by the pinned compatibility evidence in
[`dsh-v03-packed-release-evidence.md`](./dsh-v03-packed-release-evidence.md):
`PACKAGE_VERSIONS` in `scripts/dsh-compat-smoke.mjs` and lock SHA
`342b360ce7d123246f7918a519dd0779203c838f9f2075ad0875374ca5e7de0f`.
That smoke ran at `3aad134`; the only changes through the browser fixed point
`69c81e8` are release-evidence documentation, and the packed tar SHA above is
identical, so the consumer lock and resolved package map remain the tested
compatibility identity for this bundle.

## Deterministic gates

The fixed source already passes the repository's 115-test suite and the
`check`, `build`, packed smoke, and `git diff --check` gates. This browser run
closes the previously environment-blocked installed Harness Session gap; it
does not expand support beyond the pinned rc.6 Web profile.
