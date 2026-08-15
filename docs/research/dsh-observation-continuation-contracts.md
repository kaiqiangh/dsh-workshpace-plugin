# DeepSeek Harness observation, durable-event, and continuation contracts

Research date: 2026-08-15
Source baseline: upstream `deepseek-ai/deepseek-harness` commit [`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a) and current npm `next` packages `0.1.0-rc.6` (the rc.6 tarball declarations were checked against the contracts below; for example [`@deepseek-ai/dsh-tools@0.1.0-rc.6`](https://registry.npmjs.org/@deepseek-ai%2fdsh-tools/0.1.0-rc.6), [`@deepseek-ai/dsh-session@0.1.0-rc.6`](https://registry.npmjs.org/@deepseek-ai%2fdsh-session/0.1.0-rc.6), and [`@deepseek-ai/dsh-agent@0.1.0-rc.6`](https://registry.npmjs.org/@deepseek-ai%2fdsh-agent/0.1.0-rc.6)).

The DSH Workspace repository does not yet pin a Harness package version. Implementation must pin one; the conclusions below are current evidence, not a compatibility promise across later release candidates.

## Resolution

### 1. Observe final live tool outcomes with `tools/result`

`ctx.on('tools/result', (exec, result) => ...)` is the public final-observation seam. It runs after pre/execute/post policy and tool-owned final content transformation. Both arguments are frozen, listener failures are contained, and the result is the authoritative returned outcome ([event contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/index.ts#L185-L199), [finalization and publication](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/index.ts#L1624-L1677)).

The useful shapes are:

- `exec`: `callId`, resolved `rootCallId`, `name`, lossless-JSON `arguments`, optional `agent`, optional opaque `parent` for nested Code Mode dispatches, and `signal` ([types](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/index.ts#L314-L405)). Agent-loop calls set `exec.agent`, so session attribution is `exec.agent.session.id`; agent-less programmatic calls have no session owner.
- success: `{ isError: false, value, content, meta?, additionalContexts?, concludesTurn? }`; failure: `{ isError: true, error: { message, info?: { name, code } }, content, meta?, additionalContexts? }` ([types](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/index.ts#L556-L580)). `value` is structured and ideal for live classification, but is deliberately absent from durable `tool/result` events.
- `callId` identifies the execution; `rootCallId` groups nested dispatches. Code Mode sub-call ids are deterministic `<parent>:code:<n>` and durable `tool/code-dispatch-start` / `tool/code-dispatch` events retain the sub-tool name, normalized arguments, error bit, and content ([types](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/types.ts#L8-L52), [append path](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/code-mode.ts#L474-L541)).

### 2. Current first-party file and shell classifications

The base bundle composes `bash` on non-Windows / `pwsh` on Windows, `read` / `read_image` / `write` / `edit`, `glob` / `grep`, and `str_replace_editor` ([bundle rows](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/base/cordis.patch.yml#L210-L232), [`str_replace_editor` row](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/base/cordis.patch.yml#L384-L389)).

| Tool | Input path evidence | Successful live `result.value` | Workspace classification |
|---|---|---|---|
| `read` | `file_path`, `offset?`, `limit?` | `{ path, offset, lines, totalLines }` | deterministic `READ` for returned `path` ([definition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs/src/read.ts#L76-L166)) |
| `read_image` | `file_path` | `{ path, image: { attachmentId, mediaType, bytes, width, height, name? } }` | deterministic `READ`; it also writes the separate attachment store ([definition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs/src/read-image.ts#L129-L207)) |
| `write` | `file_path`, `content`, optional sandbox escalation | `{ path, operation: 'create'|'update', before: string|null, after }` | deterministic `CREATED` / `MODIFIED` from `operation` ([definition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs/src/write.ts#L66-L130)) |
| `edit` | `file_path`, `old_string`, `new_string`, `replace_all?`, optional sandbox escalation | `{ path, before, after }` | deterministic `MODIFIED` ([definition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs/src/edit.ts#L76-L148)) |
| `str_replace_editor` | `command`, absolute `path`, command-specific fields | string only | `view` is `READ`; `create` is potentially `CREATED`; `str_replace` / `insert` are potentially `MODIFIED`. The arguments, not the result string, are the stable classifier ([schema and dispatch](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-str-replace-editor/src/index.ts#L390-L490)). |
| `glob` | `pattern`, optional search-root `path` | `{ root, paths[] }` | discovery, not file-content `READ`; paths are complete in live `value` ([definition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs-search/src/glob.ts#L312-L371)) |
| `grep` | `pattern`, optional `path`, optional `include` | `{ matches: [{ path, lineNumber, line }] }` | matching paths are observed reads, but the result cannot identify files searched with no match ([definition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs-search/src/grep.ts#L283-L346)) |
| `bash` / `pwsh` | command, description, optional `workdir`, timeout/background/sandbox fields | foreground `{ kind, exitCode, signal, timedOut, aborted, timeoutMs, stdout, stderr, sandbox? }`; background `{ kind: 'background', jobId }` | always **potentially mutating**; no touched-path list exists. A non-zero exit is still a successful tool result with `exitCode`; a background result is only a start acknowledgement, not process completion ([bash schema and execution](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/tool-bash/src/index.ts#L240-L383), [shell outcome contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/shell/shell/src/types.ts#L89-L139)). |

Consequences for Workspace:

- Use structured `exec.arguments` and successful `result.value`; do not parse rendered `content` when live.
- Treat every shell call and every mutating-tool attempt as a Git/filesystem refresh trigger. A final error is not proof of no mutation: a tool body may have changed disk before later observation/post-policy failed.
- Shell paths, deletions, renames, and indirect outputs require post-execution Git/filesystem reconciliation. `tools/result` alone cannot enumerate them. Background shell work additionally requires observation at job settlement; its `bash` result only contains a job id.
- Normalize every discovered path against the owning session's `session.header.cwd`; `exec.arguments` may be relative while returned filesystem `path` is backend display data.

### 3. Durable events and replay

A `SessionEvent` is `{ type, seq, time, data, ignorable? }` plus surface metadata for message-producing event types. `seq` is monotonic within one session; the event carries no standalone global id and no `sessionId` ([envelope](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/types.ts#L377-L435)). Therefore:

- use `(session.id, event.seq)` as the durable occurrence identity;
- use `callId` / `subCallId` to correlate tool call and result records;
- add a plugin-owned id only when an activity must be referenced independently of its log position.

`session.append(type, data)` losslessly snapshots and freezes JSON data, assigns `seq` / `time`, commits to the append-only log, then emits `session/event`. The emit is post-commit and fire-and-forget; it is not a persistence acknowledgement ([append](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/index.ts#L564-L656), [`session/event` contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/index.ts#L68-L87)). Persistence buffers these events and `ctx.sessions.flush(session)` / `session/flush` is the explicit durability barrier ([persistence contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-persistence/README.md#the-write-coordinator)).

Resume does **not** replay old events through `session/event`: constructor seeds are available through `session.events`, and `firstLiveSeq` marks where this process's writes begin ([seed contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/index.ts#L449-L475)). A Workspace projection must fold the existing log once at attachment/resume, then consume later `session/event`s incrementally.

Existing durable tool records are usable without a new vocabulary:

- native calls: `tool/call` has `callId`, name, and raw argument JSON; `tool/result` has the correlated `ToolResultMessage`, failure identity, and replay-safe tool `meta` ([event types](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/types.ts#L273-L297));
- Code Mode: `tool/code-dispatch-start` / `tool/code-dispatch` retain structured sub-call arguments and outcome ([event types](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/tools/src/types.ts#L8-L52)).

**Blocking gap:** the ARD's proposed out-of-repo `declare module ... { 'workspace/activity': ... }` event can compile and append live, but it is not cold-replay-safe. The current persistence reader uses a generated in-repository allow-list and explicitly says downstream plugin events are outside it and that a registration surface is deferred ([generated vocabulary](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/session/src/known-event-types.ts#L8-L23)); unknown required types make load refuse, while public `Session.append()` exposes no way to mark an event `ignorable`. Therefore v0.1 must either:

1. derive replayable activity from existing durable tool events and accept the shell/unmatched-grep gaps, or
2. use a separately designed sidecar store, or
3. wait for / contribute an upstream downstream-event registration contract.

Do not persist `workspace/*` events in the external plugin against rc.6.

### 4. `Agent.followup()` and `Agent.steer()`

Both public methods take one already-identified `UserMessage` and return `void`. Construct it once with `createUserMessage({ content, source })`; this creates a stable `MessageId` ([message constructor](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/llm/llm/src/message.ts#L127-L202)). The public Agent contract is:

- `followup(message)`: append to the `next-turn` FIFO and wake the driver; each ordinary queued message owns its own turn.
- `steer(message)`: append to `next-step` and wake; while running it is claimed at the nearest later step boundary, and while idle it starts a turn. It does not abort the in-flight model/tool operation.

These semantics are specified by the Agent interface and implemented as fixed aliases over `send()` ([public interface](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent/src/runtime-types.ts#L103-L134), [implementation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-loop/src/agent.ts#L111-L132)). The enqueue itself appends the durable `agent/inbox/spliced` event before mutating the live inbox projection ([inbox mutation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent/src/inbox.ts#L176-L192)).

Working Set should choose semantics, not race on a sampled status:

- use one `followup()` when “Send to Agent” means a separate next-turn scope instruction after current work;
- use one `steer()` when it must affect the nearest next model step (and also work from idle).

Resolve a fresh live Agent from the registry immediately before delivery; do not retain an old handle across disposal/resume. The first-party SDK explicitly checks that its retained handle is still the registered instance because a disposed handle can otherwise accept `followup()` silently ([SDK guard](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/sdk/server/src/server.ts#L132-L150)). Keep the created `message.id` for UI correlation; neither Agent method returns an acknowledgement or id. Await an explicit session flush only if the UI promises the enqueue is physically durable before confirming.

One documentation conflict remains: the public `steer()` JSDoc says a rejected step leaves steering parked, while the concrete loop claims inbox input before `agent/pre-step` and the agent-loop README says rejection leaves the claimed batch removed ([claim-before-waterfall](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-loop/src/agent.ts#L225-L244), [README contract](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/core/agent-loop/README.md#internal-concrete-driver)). Workspace must not promise automatic retry after a pre-step rejection until upstream resolves that contradiction.

## Planning answer

The MVP route that holds is: observe live final outcomes with `tools/result`; classify first-party tools by the table above; reconcile every potentially mutating or shell call against Git/filesystem state; rebuild resumed activity from existing durable tool events; and send the Working Set as exactly one freshly identified `followup()` (separate turn) or `steer()` (nearest step). Custom durable `workspace/*` events are blocked on a missing upstream event-vocabulary registration seam and should not be part of the rc.6 implementation plan.
