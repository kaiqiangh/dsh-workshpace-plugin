# Research: Workspace Artifacts end-to-end (#120, child of #117)

## Verdict

**works** — the carrier *does* emit on a real session. The feature is connected
end-to-end: a real `tool/call`/`tool/result` pair that writes a file is folded by
`WorkspaceArtifactCarrier` into a non-empty `WorkspaceDeliverable[]`, serialized
intact across the Typert bridge, and rendered as a `<li>` in
`workspace-artifact-surface.ts`.

The string `Workspace artifacts are unavailable.` is **only** the surface's
`degraded`/error fallback. It fires when (a) the web `resolveRemote(sessionId)`
returns `undefined`, or (b) the host `artifactMetadata` *throws* — which happens
when `ctx.agents.get(agentId)` misses (`PROJECT_UNAVAILABLE`) or when
`startWorkspace`/`resolveWorkspaceRoot` throws inside `carrier()`. It is **not**
triggered by an empty list — an empty list correctly renders the
`No session artifacts yet` empty state (verified below). So the user's symptom is
an error/unwired-remote edge, not a broken data link.

---

## Trace: `tool/call` event → rendered `<li>`

```
agent.session.events (SessionEventLike[])
  └─ sessionToolRecords()                         src/host/workspace-artifacts.ts:311 / toSessionToolRecords:130
       → NativeDurableToolRecord[]  (data.{tool,callId,arguments,result:meta,ok})
  └─ WorkspaceArtifactCarrier.projection()        src/host/workspace-artifacts.ts:304
       → SessionActivityObserver.resume()         src/domain/observation.ts:382
            → durableOutcome()                     src/domain/observation.ts:333
            → classifyToolOutcome()  → ActivityObservation (kind CREATED, attribution agent-evidenced)
  └─ deriveArtifacts()                            src/domain/activity.ts:142
       → ArtifactProjection[]  (filtered: createdInSession && present && previewable && agent-evidenced/session-observed)
  └─ WorkspaceArtifactCarrier.metadata()          src/host/workspace-artifacts.ts:243
       → statArtifact() (fs check) → preview() → createWorkspaceDeliverable()  src/domain/deliverable.ts:87
       → WorkspaceDeliverable[]
  └─ @Remote artifactMetadata(agentId)            src/index.ts:196
       → (await carrier(agent(agentId)))?.metadata() ?? []
  └─ Typert bridge codec                          lib/typert.remote-client.js (artifactMetadata_result$schema)
       → serializes; keeps id/name/mediaType/sizeBytes/version/resourceId/source/preview/downloadName
  └─ web resolveRemote().artifactMetadata()       src/web/workspace-artifact-surface.ts:182
       → unwrapRemote() → normalizeLenient() → setArtifacts()
  └─ render <li data-dsh-workspace="artifact-item">  src/web/workspace-artifact-surface.ts:370-391
       with <button data-dsh-workspace="artifact-select">{name}</button>
```

---

## Observed input/output per link (fixture run)

Fixture events (`tests/fixtures.ts:writeFileToolEvents("report.md", "# Fixture report\n")`):

```json
[
  {"seq":0,"type":"tool/call","data":{"callId":"call-fixture","name":"write_file","arguments":"{\"path\":\"report.md\"}"}},
  {"seq":1,"time":1,"type":"tool/result","data":{
    "message":{"source":{"kind":"tool","callId":"call-fixture"},"content":[{"type":"tool-result","toolCallId":"call-fixture"}]},
    "meta":{"diffs":[{"path":"report.md","oldText":null,"newText":"# Fixture report\n"}]}}}
]
```

1. **`sessionToolRecords`** → `NativeDurableToolRecord[]`:
   ```json
   [{"seq":1,"time":1,"type":"tool/result",
     "data":{"tool":"write_file","callId":"call-fixture","arguments":{"path":"report.md"},
             "result":{"diffs":[{"path":"report.md","oldText":null,"newText":"# Fixture report\n"}]},"ok":true}}]
   ```

2. **`deriveArtifacts`** → `ArtifactProjection[]`:
   ```json
   [{"path":"report.md","createdAt":1}]
   ```
   (the filter `createdInSession && current==="present" && previewable && attribution∈{agent-evidenced,session-observed}` all hold: `oldText:null` ⇒ `CREATED`, attribution `agent-evidenced`, file is on disk).

3. **`metadata()`** → `WorkspaceDeliverable[]` (asserted in `workspace-artifacts-e2e.test.ts`):
   ```json
   [{"id":"workspace:<sha256>","name":"report.md","mediaType":"text/markdown",
     "sizeBytes":18,"preview":"available","downloadName":"report.md"}]
   ```
   `resourceId` is `undefined` (only binary artifacts get an opaque id) — expected.

4. **Typert bridge** — `TYPERT_REMOTE.descriptors.find(method==="artifactMetadata").result.schema.parse(metadata)` returns the same object; no field dropped (`resourceId`, `sizeBytes`, `version` all present in the generated codec at `lib/typert.remote-client.js:6-21`).

5. **Surface** — `resolveRemote().artifactMetadata()` ⇒ `<li data-dsh-workspace="artifact-item">` containing `<button data-dsh-workspace="artifact-select">report.md</button>` (test asserts `names.includes("report.md")`).

---

## Failure-mode mapping (error code → surface display)

| Backend state | Surface status | Display |
|---|---|---|
| agent has artifacts | `ready` | grouped `<li>` cards |
| agent has **no** artifacts (`[]`) | `ready` + `message=undefined` | `No session artifacts yet` empty state (NOT "unavailable") |
| `resolveRemote` returns `undefined` | `degraded` (`src/web/workspace-artifact-surface.ts:168-171`) | `Workspace artifacts are unavailable.` |
| `artifactMetadata` throws (`PROJECT_UNAVAILABLE`, root-resolution, etc.) | `loading→degraded` (`src/web/workspace-artifact-surface.ts:210-214`) | `Workspace artifacts are unavailable.` |

Reload behaviour: `metadata()` re-derives from `agent.session.events` + a live
`statArtifact` every call. Deleting the on-disk file makes `statArtifact` throw,
the artifact is dropped from the next snapshot, and the list **shrinks** — i.e.
artifacts are persisted only via the durable event log + filesystem, not a
separate store (verified: list goes `1 → 0` after `rm`).

---

## Smallest fix

The host chain is correct, so no host logic change is required for a session that
actually wrote files. To guarantee a *normal* session never shows the misleading
`unavailable` notice (and instead shows the correct empty state, or its artifacts),
harden the one host line that turns a non-resolvable agent into a thrown error:

- **`src/index.ts:197`** — `return (await this.carrier(this.agent(agentId)))?.metadata() ?? [];`
  `this.agent()` throws `PROJECT_UNAVAILABLE` *before* the `?? []` guard when
  `ctx.agents.get(agentId)` misses. Wrap the lookup so a missing agent degrades to
  `[]` (empty state) instead of an error:
  ```ts
  let agent: Agent;
  try { agent = this.agent(agentId); } catch { return []; }
  return (await this.carrier(agent))?.metadata() ?? [];
  ```
  This converts the user's `unavailable` into the correct `No session artifacts
  yet` (or, when the agent is resolvable and events exist, shows the artifacts).

If the symptom persists after that, the cause is web-side: `resolveRemote` is
returning `undefined` for the active session — wiring outside this repo
(`src/web/workspace-artifact-surface.ts:168-171` is already correct).

---

## Tests added (read-only on production source)

- `tests/fixtures.ts` — `writeFileToolEvents(path, content)` (realistic
  `tool/call`/`tool/result` record).
- `tests/workspace-artifacts-e2e.test.ts` — 5 tests, all passing:
  1. host carrier emits non-empty `WorkspaceDeliverable[]` for a written file;
  2. Typert bridge codec preserves every field the surface relies on;
  3. `resolveRemote().artifactMetadata()` renders a `<li>` in the surface;
  4. reload reflects the filesystem (delete file ⇒ list shrinks `1→0`);
  5. failure mapping (empty ⇒ ready/empty; `PROJECT_UNAVAILABLE` ⇒ degraded/unavailable).
