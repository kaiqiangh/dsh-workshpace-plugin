# DSH plugin, Host/Web, and conversation-node contracts

Verified 2026-08-15 against official DeepSeek Harness `master` at
[`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a).

## Decision

DSH Workspace can remain one distributable plugin bundle with a Host entry and a Web Client entry. Use Cordis for composition and disposal, Typert Remote for typed unary JSON requests, the built-in Agent scope for session identity, a separate `ctx.webServer` route for binary bytes, and the documented `ConversationNodeDefinition` plus keyed `conversation.chat.node` renderer for the chat summary.

The architecture must not treat these APIs as semver-stable. DeepSeek Harness explicitly remains a developer preview with expected breaking changes. Pin the exact DSH and leaf-package versions, keep all Harness imports behind one thin adapter, and require one build/runtime compatibility smoke test before implementing Workspace features. [Official status](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/README.md#L9-L23)

## Verified contracts

### Packaging and registration

- The installable unit is an npm **bundle** declaring `dsh.bundle.patch`; its `cordis.patch.yml` inserts the plugin's Loader row, and users install it into a profile with `dsh plugin --profile <name> add <package>`. [Bundle and profile contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/basic/publish.md#L9-L64) · [Install flow](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/basic/publish.md#L75-L110)
- A Web contribution is discovered from an enabled Loader package that declares `dsh.client` with `platform: "web"` and exports a built `./client` bundle. Missing or malformed Client metadata fails loudly during activation. [Client module discovery](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/client-modules.md#L47-L57)
- Therefore, the minimum external shape is one package with `dsh.bundle` and `dsh.client`, a root Host plugin export, `exports["./client"]`, and a patch inserting that package. This last sentence is an inference from the two documented contracts, not a published copy-ready external TypeScript template.

### Lifecycle and disposal

- `inject` gates activation on required services and unloads/reloads the dependent plugin when a service disappears. Registrations made through Cordis APIs unwind with the owning Fiber; custom watchers, handles, and resources belong inside `ctx.effect()`. `fiber.dispose()` waits for child disposal and asynchronous cleanup. [Lifecycle contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/framework/index.md#L26-L63) · [Dispose guarantees](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/framework/index.md#L78-L107)
- DSH Workspace must register its filesystem observers, Git debounce/timers, Client definitions, Remote contribution, and resource route as Fiber-owned effects. If teardown ordering matters, one disposer must await the steps in order because separate async disposers may run concurrently. [Disposer ordering](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/framework/index.md#L57-L63)

### Host services and typed Host-to-Web requests

- A Host-only Workspace service can be an ordinary Cordis `Service`. The public typed Host/Web boundary is **Typert Remote**: extend `TypertRemoteService` (or use `bindTypertRemote`), mark exposed methods with `@Remote` or `@RemoteScope`, and leave every unmarked method Host-only. An optional final `AbortSignal` provides cooperative cancellation. [Programming model](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L7-L56)
- Generated Client methods appear as concrete `ctx.remote.<namespace>.<method>` or scoped `agentCtx.remote.<namespace>.<method>` functions. The Client contribution is mounted with `ctx.remote.$mount()` and unload removes methods, aborts in-flight calls, and invalidates stale handles. [Client call shape](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L58-L78) · [Unload behavior](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L121-L129)
- Strict publication generates `lib/typert.host.*` and `lib/typert.remote-client.*`; the package exposes them as `./typert` and `./remote`. The Host Typert Loader automatically discovers `./typert` on Loader entries, but current docs say Client discovery still needs a separate composition owner. [Generated artifacts](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L95-L117) · [Host discovery and Client limitation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/typert/loader/README.md#L5-L24)
- The official build requires Host generation before Client compilation; source-mode descriptors are weaker and cannot be mounted by the Client without strict generated codecs. DSH Workspace must generate and ship both faces and must not depend on the source fallback. [Build order and source fallback](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L131-L156)

### Session scoping

- For methods taking an `Agent`, the standard `agent` lookup replaces the Host object with a wire `agentId`. `@RemoteScope('agent')` instead resolves the scoped Host Context. On the Client, the same call can be made without passing the id through `AgentContext`; direct root-context calls pass the `SessionId` explicitly. [Lookup and scope contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L9-L15) · [Direct and scoped example](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L58-L74)
- The standard resolver reuses a live Agent, resumes an ordinary cold session, deduplicates concurrent resumes, and rejects subagent-owned identities. Workspace code must resolve per call and never cache a live `Agent` across unload/resume. [Resolver semantics](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L121-L129)
- The Client Agent scope uses the same branded `SessionId` for agent and session identity, and its Fiber owns scoped registrations. [Client Agent scope source](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/runtime/src/client/agents/scope.ts#L1-L68)

For DSH Workspace, every file-tree, preview, change, activity, and Working Set request should be Agent-scoped. The Host derives the authoritative workspace root from the resolved Agent/Session; the browser never supplies an absolute root.

### Binary resources

- Typert Remote is unary and its strict schemas cover JSON-representable values; streaming, pagination, and other data protocols are explicitly outside Remote. [Strict data boundary](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L117-L125) · [Unary boundary](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/api-gateway.md#L158-L164)
- `@deepseek-ai/dsh-host-webserver` publicly provides `ctx.webServer.register()` for exact or prefix HTTP routes; the handler owns the response lifecycle and the returned disposer removes the route. It is browser-Web-only and provides no TLS, authentication, or origin policy. [WebServer route contract and limits](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/host/webserver/README.md#L5-L21)

The minimum safe split is:

1. A typed Remote returns `{ resourceId, mediaType, size }`, never a Host path or bytes.
2. A Fiber-owned, namespaced Web route accepts `resourceId`, binds it to the requesting session, revalidates the workspace path at open time, enforces size/type limits, and streams the bytes with explicit content headers.
3. The Client fetches that route and creates a browser object URL only for the preview lifetime.

This route is valid for the PRD's `dsh web` MVP, but it is not transport-neutral. Electron or another Client carrier will require a separate binary transport because the official WebServer contract is browser-only.

### Durable events and conversation rendering

- Plugin event families extend `@deepseek-ai/dsh-session/types#SessionEventMap`; the Host appends lossless-JSON events to the session log. `Session.append()` assigns sequence/time, freezes the snapshot, and synchronously publishes `session/event`. [Session append contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/index.ts#L569-L655)
- `ConversationNodeDefinition` is exported by `@deepseek-ai/dsh-client-runtime/client`. It matches one current event to a stable `(kind, id)`, starts/folds deterministic State in log order, and builds renderer-ready target data. [Definition contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/client/runtime/src/client/contract/conversation.ts#L164-L228)
- The official recipe merges the event types, `ChatNodeDataMap`, and optional Location data maps; registers the definition through `ctx.conversationEvents.register()`; and installs the keyed renderer through `ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(...))`. The renderer key must equal the node `kind`. [Complete registration recipe](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/cookbook/adding-a-conversation-node.md#L25-L193)
- Each event in a multi-event node must carry the same stable business id; updates must replay deterministically, preserve `context.key`, and avoid scanning the event window or rendered nodes on append. [Replay and identity rules](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/cookbook/adding-a-conversation-node.md#L9-L23) · [Incremental-path rules](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/cookbook/adding-a-conversation-node.md#L196-L220)

For the MVP, publish a compact durable Workspace summary node only. Keep file trees, preview bodies, diffs, and binary data out of conversation events; fetch them on demand through the Host boundary.

## Minimum compatibility boundary

1. Pin the tested `@deepseek-ai/dsh` release and every directly imported leaf package; do not use floating prerelease ranges.
2. Put DSH-specific code in four adapters: plugin activation/disposal, Typert Host/Client transport, session event emission, and conversation-node registration.
3. Before feature implementation, prove one installed external bundle can: load both faces, mount one strict Agent-scoped Remote, return a JSON value, serve one bounded binary resource, render one replayed conversation node, and dispose every registration.
4. Fail plugin activation on missing exports/services or a contract mismatch; do not silently fall back to untyped fetch or source-mode Remote descriptors.
5. Treat only `dsh web` as the v0.1 transport target. Do not claim Electron/desktop compatibility from the WebServer route.

## Current package snapshot

The npm registry currently reports `@deepseek-ai/dsh` `0.1.0-rc.6` and `@deepseek-ai/cordis` `4.0.1`. The relevant published leaf packages are `0.0.1-rc.1`: `dsh-client-runtime`, `dsh-client-ui-conversation`, `dsh-client-ui-slots`, `dsh-api-gateway`, `dsh-api-remotes`, `dsh-typert-generator`, `dsh-typert-registry`, `dsh-host-webserver`, and `dsh-session`; `dsh-typert-protocol` is `0.1.0-rc.6`. The published tarballs for Client Runtime, UI Conversation, and Host WebServer contain the named declaration exports verified above. [DSH registry metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh/latest) · [Client Runtime metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh-client-runtime/latest) · [UI Conversation metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh-client-ui-conversation/latest) · [WebServer metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh-host-webserver/latest) · [Typert Protocol metadata](https://registry.npmjs.org/@deepseek-ai%2fdsh-typert-protocol/latest) · [Cordis metadata](https://registry.npmjs.org/@deepseek-ai%2fcordis/latest)

The source revision's workspace manifests still show `0.1.0-rc.5`, while registry leaf packages use a separate prerelease version line. There is no official release tag tying those two views together. Record both the source SHA and the installed package lock in every compatibility result; neither alone proves the other.

## Gaps that remain decisions, not assumed contracts

- The official docs describe the in-repository ordered Typert build, but not a complete out-of-tree package configuration that generates and self-mounts `./remote`. The compatibility smoke test above must settle the external build recipe before the implementation topology is final.
- There is no framework-provided opaque Workspace resource registry, session authorization scheme, range-response helper, or transport-neutral binary API. DSH Workspace owns those narrow policies on top of `ctx.webServer` for Web v0.1.
- The API and package versions are prereleases with explicit compatibility-break warnings. Upgrading DSH is a deliberate compatibility task, not an automatic dependency update.
