# DSH Workspace v0.2–v0.5 release and support gates

Research snapshot: 2026-08-15. This decision is based on the public DeepSeek
Harness source at commit
[`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a),
the npm registry metadata checked on this date, and the current
[`scripts/dsh-compat-smoke.mjs`](../../scripts/dsh-compat-smoke.mjs) fixture.

## Decision

The supported release target for v0.2–v0.5 is one prebuilt DSH bundle with a
Host face and a browser Web Client face, installed into a local `dsh web`
profile. The compatibility claim is exact and reproducible: the source SHA,
package lock, generated Typert faces, and packed consumer must be recorded
together. A registry dist-tag, source checkout, or successful type check alone
is not release evidence.

Harness is still a developer preview and explicitly warns of
compatibility-breaking changes. The adapter boundary therefore remains a
release invariant: changes to public Harness contracts require a new
compatibility spike before the feature release can proceed.

## Pinned baseline

The platform target is `@deepseek-ai/dsh@0.1.0-rc.6`. The compatibility fixture
pins the directly exercised contracts and build tools as follows:

| Package | Exact version |
|---|---|
| `@deepseek-ai/cordis` | `4.0.1` |
| `@deepseek-ai/dsh-api-gateway` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-agent` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-client-runtime` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-client-ui-slots` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-host-webserver` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-system-prompt` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-token-meter` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-typert-generator` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-typert-protocol` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-typert-registry` | `0.1.0-rc.6` |
| `tsdown` | `0.22.14` |
| `typescript` | `6.0.3` |
| `zod` | `4.4.3` |

The registry exposes `0.1.0-rc.6` as the `latest`/`next` tag for
`@deepseek-ai/dsh` and `dsh-agent`, but most leaf packages still expose
`0.0.1-rc.1` as `latest` and `0.1.0-rc.6` as `next`. Every leaf must therefore
be specified explicitly; `npm install` without a version is not reproducible.
The `dsh-typert-registry` package is explicitly pinned to `0.1.0-rc.6` in the
existing fixture and must not be replaced by the `latest` tag (`0.0.1-rc.1`)
or silently widened to a prerelease range. The smoke's exact lock assertion is
the authority for the tested baseline.

The generated consumer lockfile is part of the evidence. The smoke script
asserts lockfile version 3 and checks every entry's resolved package version;
the recorded SHA-256 of both profile and consumer lockfiles must travel with
a release report.

## Support matrix

| Surface or feature | v0.2–v0.5 decision | Required boundary |
|---|---|---|
| Local `dsh web` Host + browser Web Client | Supported; blocking gate | Installed packed bundle, not repository source; `dsh.bundle.patch`, `dsh.client.platform: "web"`, and `exports["./client"]` are present. |
| Host Typert face | Supported; blocking gate | Strict generated `./typert` descriptors load and register; no source-JSON fallback. |
| Browser Typert face | Supported; blocking gate | Generated `./client/typert` and `./remote` load in the browser bundle and unregister on disposal. |
| Agent-scoped v0.2 context | Supported on rc.6 | Use public agent-scoped `systemPrompt.context`; content is bounded, hashed, session/root-bound, and admission is deterministic. `Agent.inject` is not the persistent carrier. |
| Workspace Web/Host requests | Supported | Typed JSON returns relative paths, opaque resource IDs, and metadata only. Host derives the root from the resolved Agent/Session. |
| Binary previews | Supported on Web only | A Fiber-owned `ctx.webServer` route revalidates session/root/path/version, type, and size at open time. No raw path query or transport-neutral claim. |
| v0.3 deliverables and extra previews | Conditional | Reuse only pinned public Harness UI contracts where present; missing optional renderers degrade to metadata/unsupported state. Generic attachment integration is unsupported until a public session-authorized file contract is verified. |
| v0.4 Project Memory | Workspace-owned local Host capability | Store and retrieval stay separate from Harness session event vocabulary; browser receives metadata and provenance, not a host database path. A missing store is explicit unavailable mode, never an in-memory success claim. |
| v0.5 Memory Governance | Workspace-owned policy layer | Scope, provenance, edit/forget/pin, last-used, conflict, and migration rules are enforced before writes. If durable provenance or authorization is unavailable, writes fail closed and the UI reports the reason. |
| Electron, desktop, remote/SSH/container roots, alternate carriers | Unsupported | Do not infer support from the WebServer smoke; each needs a separate public transport and filesystem compatibility spike. |
| Floating prerelease ranges, private APIs, untyped fetch, source-mode Typert | Unsupported | Activation and smoke fail rather than silently downgrading the contract. |

The Harness publish guide distinguishes an installable bundle from a profile:
the bundle contributes `dsh.bundle.patch`, while the profile composes bundles.
The release artifact should ship built output through npm or a tarball. A Git
install is supportable only when the package ships a self-contained `prepare`
build, the user explicitly allows that build under pnpm, and the dependency is
pinned to a commit. The supported product path is the prebuilt artifact.

## Blocking acceptance gates

Every v0.2–v0.5 release must leave an evidence record for each gate:

1. **Baseline and package identity.** Record the source SHA, exact package
   versions, lockfile v3 SHA-256, Node/npm/pnpm versions used by the run, and
   the plugin package version. No dist-tag or floating range may appear in the
   release manifest.
2. **Packed bundle.** Run the existing smoke against an npm-packed plugin in a
   clean consumer. Assert bundle metadata, `./client`, generated Host and
   Client faces, strict descriptors, and all required public imports. Do not
   import repository source as compatibility evidence.
3. **Host/Web lifecycle.** In the installed fixture, exercise Agent-scoped
   JSON registration, one bounded Web resource, one conversation node, and
   disposal. Disposal must remove Typert registrations, routes, conversation
   definitions/views, timers, and context carriers; no late update may publish.
4. **v0.2 context.** Prove deterministic admission, token/capacity reporting,
   content hashes, refresh-on-change, omission reasons for stale/unreadable/
   oversized entries, and replacement/disposal of the public carrier. The
   Agent must remain idle after registration; no hidden follow-up or steer is
   permitted.
5. **v0.3 deliverables.** Prove session-wide artifact derivation (including
   indirectly filesystem-created files), bounded preview/download behavior,
   path and resource authorization, and explicit unsupported states for every
   renderer or attachment capability not present in the pinned Harness.
6. **v0.4 memory.** Prove a durable round trip across restart/resume, explicit
   Session/Project/User scope separation, project identity binding, bounded
   retrieval, provenance on every returned fact, and a corruption/unavailable
   store mode that does not claim persistence.
7. **v0.5 governance.** Prove authorized edit, forget, and pin operations,
   immutable provenance/history, last-used updates, deterministic conflict
   handling, scope-aware privacy filtering, and migration/rollback behavior.
   Governance writes must fail closed on missing identity or storage.
8. **Security and privacy.** Run traversal, absolute/Windows path, symlink/
   junction, deleted-file race, oversized input, opaque-resource tampering, and
   browser leakage fixtures. Browser data must contain no absolute host path,
   host database path, or unapproved content/network export.

The current repository commands are the deterministic base gate:

```sh
npm test
npm run check
git diff --check
npm run smoke:compat
```

`smoke:compat` installs the exact fixture, runs strict TypeScript/build steps,
packs and installs the consumer, loads both public faces, exercises the Host
gateway and bounded Web route, replays the conversation node, and checks
disposal. A release still needs the real installed `dsh web` profile/browser
run for the supported OS/browser matrix; the fixture is not a substitute for
that host run.

## Degraded and unsupported behavior

The following are local, observable degradation states: non-Git roots or Git
unavailability; missing, stale, unreadable, deleted, oversized, or unsupported
previews; optional renderer failure; context entries omitted for capacity or
source errors; and unavailable Project Memory storage. These states preserve
the other capabilities and never fabricate content, provenance, or persistence.

The following are release blockers rather than degradation: missing bundle or
Client metadata, missing generated Typert face, missing public Agent context
carrier, missing required Web resource carrier, source-mode/untyped fallback,
path or content leakage, disposal failure, or a failed packed-consumer smoke.

## Upgrade policy

Open a compatibility-spike ticket before accepting any of these changes:

- Harness source SHA, `@deepseek-ai/dsh` version, or any pinned leaf/toolchain
  version or lockfile entry;
- Typert generated descriptor shape, Remote/Agent scope, context/token-meter
  behavior, `ctx.webServer`, Client module metadata, or conversation-node API;
- a reused Harness UI primitive, deliverable/attachment contract, browser or
  Node major version, or package build/output layout;
- a security update that changes a transitive package or generated bundle.

The spike must update this matrix, rebuild the packed consumer, rerun all four
base commands and the real `dsh web` profile/browser run, compare the new
lockfile and generated-face hashes, and record any migration or degraded mode.
If a public contract disappears or changes incompatibly, keep the old pin as
the supported release and open a separate migration issue; never broaden a
range or add a private/untyped fallback to make the smoke green.

## Primary sources

- [Harness README at the pinned commit](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/README.md) — developer-preview status and `dsh web` entry point.
- [Harness bundle/profile publishing guide](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/basic/publish.md) — bundle metadata, profile installation, and Git/prebuilt artifact rules.
- [Harness Client Modules contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/client-modules.md) — `dsh.client`, `platform: "web"`, `./client`, boot graph, and fail-loud activation.
- [Harness API Gateway contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md) — strict Host/Client Remote boundary and generated faces.
- [Harness WebServer contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/webserver/README.md) — public Web route and disposal boundary.
- [npm `@deepseek-ai/dsh` metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh/latest) and [rc.6 Agent metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh-agent/0.1.0-rc.6) — registry version checks.
