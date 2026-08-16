# DSH Workspace Plugin — Full Codebase Review Report

> **⚠️ SUPERSEDED (2026-08-16, v0.3.0).** This review describes the state at
> `dev` HEAD `fec5bf2`. The follow-up work was delivered in v0.3.0 — see
> [`CHANGELOG.md`](CHANGELOG.md) and
> [`adr/0011-workspace-v07-surface-ux-and-hygiene.md`](adr/0011-workspace-v07-surface-ux-and-hygiene.md).
> In particular, the Git Changes/Diff view now exists with colored diffs and
> stats, `memoryMarkUsed`/`memoryClose` are wired, the summary card data flow is
> fixed, and the surfaces were redesigned. Keep this file only as a historical
> snapshot; do not use it to judge the current codebase.

**Review date:** 2026-08-16
**Scope:** `dsh-workshpace-plugin` (`dev` branch, HEAD `fec5bf2`, v0.2.0)
**Focus:** Memory implementation, Artifact Preview / Diff inspection, docs-vs-code comparison, closed-Issue tracking

---

## 1. Executive Summary

The **domain layer of this project is very high quality**: path safety (realpath traversal + TOCTOU version checks), bounded previews, JSONL memory storage, the governance state machine, and the opaque resource route are all rigorously implemented, and all 116 tests pass.

However, the **scope actually shipped in the product UI is much narrower than the design docs (PRD/ARD)**. The final Web UI has just one panel with two tabs: **Artifacts** and **Memory**. The v0.1 PRD core features — file tree (F01), Git status (F09), **Git diff / Changes view (F10)**, Session Files list & timeline (F11–F13), Working Set UI (F15–F16), and chat path links (F17) — **never made it into the final UI**, and Git diff, the file tree, and the Working Set have no Host-side RPC at all.

**The observation that "Artifact preview / diff inspection is not visible" is correct**:
- Artifact Preview: **implemented and feature-complete** (seven types: text/code, Markdown, JSON, CSV, image, PDF, unsupported/error), hidden inside the Artifacts tab — selecting an artifact renders it automatically.
- **Diff inspection: not implemented at all.** There is no git subprocess call anywhere in `src/` (no `child_process`/`execFile`/`spawn`), no `diff`/`gitStatus` RPC on the Host, and no Changes tab in the UI.

**Memory: the implementation is complete and matches the v0.4/v0.5 design**, but there are 2 small wiring gaps (`memoryMarkUsed`/`memoryClose` RPCs are registered on the Host but never called from the Web → `useCount`/`lastUsedAt` are effectively never updated by the UI).

---

## 2. Project Overview

| Item | Status |
| --- | --- |
| Package | `dsh-workspace-plugin@0.2.0`, a Cordis plugin |
| Positioning | Workspace panel (Artifacts + Memory) for the DeepSeek Harness Web UI |
| Harness baseline | source `47f943859…`, npm `0.1.0-rc.6` |
| Tests | `npm test`: **116 passed / 0 failed** (the evidence doc claims 115; the last commit added 1) |
| Verification | `check`, `build`, `smoke:compat`, `git diff --check` all pass |
| Git | `dev` branch clean; PR #33 (v0.1) and #64 (v0.2–v0.5) both merged |
| Issues | All 63 Issues **closed**, no open Issues |

---

## 3. Deep Memory Review (v0.4 Project Memory + v0.5 Governance)

### 3.1 Implementation vs design

| v0.4/v0.5 design (docs/research/dsh-v04-project-memory-decision.md, dsh-v05-memory-governance-decision.md) | Status |
| --- | --- |
| JSONL append-only store, no new dependencies, no SQLite | ✅ `memory-store.ts` (36,714 bytes, rigorously implemented) |
| 4 scopes: Session / Project / User / Shared Project, each with its own store | ✅ Paths: `DSH_HOME/workspace-memory/{sessions/<hash>,user.jsonl}` and `projectRoot/.dsh/workspace-memory/{records,shared}.jsonl` |
| Record schema (schemaVersion/id/scope/type/title/content/tags/provenance/hash/status/governance) | ✅ Fully implemented + bounded validation on every field |
| Corrupt-line quarantine to `.corrupt` sidecar, unknown schema read-only, migration + atomic compaction + `.bak` | ✅ Complete |
| File lock (concurrent-write protection, stale-lock recovery) | ✅ `withLock` (30s stale expiry, 2 attempts) |
| Path-escape protection (realpath traversal + per-level checks) | ✅ `ensureSafePath()` |
| Optimistic concurrency (id+revision+contentHash, CONFLICT returns both sides' metadata) | ✅ Complete |
| Governance state machine: verify/reject/reverify/stale/pin/unpin/archive/restore/forget | ✅ `transitionMemoryGovernance()`, strict transition validation |
| Provenance (origin/sourceRefs/verification/confidence/revision/conflictGroup/pinnedAt/expiresAt/retention) | ✅ Complete |
| Scope authorization matrix (cross-scope read/write rejected, Shared Project needs opt-in + write-ack) | ✅ `assertRequest`/`assertWritableRequest` |
| Expiry → stale → cannot pin | ✅ `expiredView()` (computed at read) + `INELIGIBLE` guard |
| Exact-duplicate merge (idempotent + provenance merge) | ✅ `upsert()` exact-duplicate branch |
| Conflict groups (same title, different content → conflictGroup + UI side-by-side comparison) | ✅ |
| Import quarantine (ID remap, hash re-check, always unverified + import sourceRef) | ✅ `importMemoryBundle()` |
| Export bundle (schemaVersion/records/governance) | ✅ |
| Forget = tombstone; physical scrub only on compaction | ✅ |
| Zero-injection guarantee (Memory ops never call Agent/followup/context/model) | ✅ Confirmed by evidence docs + code inspection |

### 3.2 Issues found in the Memory feature

| # | Issue | Severity | Details & suggestion |
| --- | --- | --- | --- |
| M1 | **`memoryMarkUsed` RPC is a dead seam**: implemented on the Host (`index.ts:236`) and in the domain, but the `client.ts` remote adapter **does not wrap it**, and the Web surface **never calls it**. | Medium | Consequence: `useCount`/`lastUsedAt` are never updated by the UI — "last-used information" (explicitly required by v0.5) is effectively broken. Suggestion: call `memoryMarkUsed` in `workspace-memory-surface.ts` on select/view, and wrap it in the client adapter. |
| M2 | **`memoryClose` RPC is never called**: stores are not released when a session ends (`WorkspaceMemoryDomain.close/dispose` only disposes everything on plugin teardown). | Low | Session stores accumulate in the Map in long-lived Web setups; suggest calling `memoryClose` on session switch/end. |
| M3 | **Conflicts only support "choose", not "merge"**: the v0.5 decision requires "side-by-side diff + explicit choose/**merge** action; a merge result must list both parents". The implemented `resolveConflict()` is "keep the selected version + reject/archive the rest", with **no merge result**. | Low | Acceptable ("choose" is a valid option), but the decision text implies both should exist; document that merge is not implemented, or add a "merge into new revision" action. |
| M4 | **Two Pin buttons are confusing**: governance "Pin/Unpin" (writes `pinnedAt`) and "Pin for review" (pure local UI state, `pinnedId`) coexist. | Low | Matches the "pinnedAt is UI state only until a governed context action exists" design, but the UX is confusing. Merge them or clearly distinguish the semantics. |
| M5 | **The whole surface is invisible without a session**: `if (!sessionId) return null;` hides Memory/Artifacts entirely on non-session pages, with no notice. | Low | Show a degraded state ("requires an active Harness session"); the code already has a degraded mechanism, just not used for the no-session case. |
| M6 | `MemoryStore.open()` loads **all** records (including forgotten tombstones) into memory — safe under the 8 MiB cap, but a minor deviation from the "only load active records into the index" decision. | Info | Acceptable; re-evaluate if the file cap is raised. |
| M7 | `withLock` only tries twice and uses a 30s stale cutoff; a concurrent write may falsely report busy during a long compaction. | Low | Make the stale threshold larger than the maximum expected operation time (or use lock renewal). |

### 3.3 Memory score

- **Completeness: 9/10** (the only real gap is M1, the last-used wiring)
- **Correctness: 9.5/10** (state machine, authorization, hashing, atomicity all rigorous)
- **Security: 9.5/10** (path traversal, isolation, no injection path)
- **Design conformance: 9/10** (highly consistent with the v0.4/v0.5 decision docs, except merge not implemented)

---

## 4. Artifact Preview / Diff Review

### 4.1 What exists (✅ implemented)

| Capability | File | Status |
| --- | --- | --- |
| Artifact list (derived from session activity, session-wide, includes indirectly-created files) | `domain/activity.ts` `deriveArtifacts()` + `host/workspace-artifacts.ts` | ✅ |
| Preview types: text / markdown / json / csv / image / pdf / unsupported / error | `domain/preview.ts` + `web/workspace-preview-adapters.ts` | ✅ |
| Markdown sanitization (remote images stripped, raw HTML disabled) | `sanitizeWorkspaceMarkdown()` | ✅ |
| Bounded limits (text 2 MiB / json 5 MiB / csv 10 MiB 1,000 rows / image 20 MiB / pdf 50 MiB, with hard ceilings) | `preview.ts` | ✅ |
| TOCTOU version check at read (`RESOURCE_STALE`) | `preview.ts:276/291` | ✅ |
| Opaque resource route (session/root bound, TTL, media-type check, no-store, safe download names, cancellation) | `host/workspace-resource.ts` | ✅ |
| Artifact download (browser blob / resource route + AbortSignal cancellation) | `web/workspace-deliverables.ts` | ✅ |
| 5s polling refresh, auto-preview on select, keyboard-operable, aria-labeled | `web/workspace-artifact-surface.ts` | ✅ |
| Coexists with the first-party Harness Produced Files row (no duplicate registration) | v0.3 decision doc | ✅ |

### 4.2 What does not exist (❌ the user's observation is correct)

| Capability | Evidence |
| --- | --- |
| **Git status view (F09)** | No `child_process`/`execFile`/`spawn`/`porcelain` anywhere in `src/`. No `gitStatus` RPC on the Host. |
| **Git diff / unified diff preview (F10)** | No `diff` RPC on the Host. `WorkspaceHostClient.diff()` (`workspace-conversation.ts:153`) is only an interface declaration, never satisfied by any implementation; the `select-change → client.diff()` branch in `createWorkspaceDrawerController` is a dead path (the controller is never wired up). |
| **Changes tab / diff UI** | The final panel only has Artifacts + Memory tabs (`workspace-panel.ts`). The four-tab drawer (Files/Session/Changes/Context) is a pure reducer only (`workspace-drawer.ts`), **with no React rendering**. |

### 4.3 Other v0.1 features missing from the final UI (❌ / ⚠️)

| PRD ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F01 | Lazy file tree | ❌ | No `listDirectory`/`readdir` implementation, no RPC |
| F11–F13 | Session Files list / timeline | ⚠️ domain only | `activity.ts` projection exists but has no RPC/UI; only used to derive artifacts |
| F15–F16 | Working Set pin/unpin/send | ⚠️ domain only | `followup.ts` (`deliverWorkingSet`/`buildWorkingSetMessage`) is **never referenced**; no RPC, no UI |
| F17 | Chat path links | ❌ | Not implemented |
| F18–F19 | Token estimation / true pinned-context injection (v0.2) | ⚠️ partial | `context.ts`/`context-carrier.ts`/`context-refresh.ts` exist, but `registerPinnedContextCarrier` is **never called**; `context-carrier`/`context-refresh` have **no consumers** (dead code); the `contextSnapshot/replaceContext` RPCs only store a client-supplied snapshot, the Host computes nothing |

### 4.4 Broken data flow of the summary card (⚠️ likely visible issue)

- The `workspace/summary` event family is defined and matched on the Web side, but **the Host never emits this event** (`index.ts` has no emit). → The Workspace summary card in chat ("N files, M changes") **will not appear or will have no data in practice**.
- The "Open Workspace" button on the card emits `workspace/open`, but **there is no listener in this plugin** to open the `<details>` panel. → Even if the card appears, the button may do nothing (unless the Harness shell listens on its own).

---

## 5. Docs vs Implementation Cross-Reference

| Doc source | Required scope | Final implementation | Gap |
| --- | --- | --- | --- |
| PRD §7.1–7.7 (v0.1) | Files / Session / Changes / Preview / Artifacts / Working Set / Chat links | Only Artifacts (+Preview) + Memory | Files, Session list, Changes/Diff, Working Set, Chat links **not delivered** |
| PRD F20 | Memory browser = Future | Implemented (v0.4/v0.5) | ✅ Ahead of schedule, but **PRD not updated** (still says Future) |
| PRD roadmap v0.2 | True Context Management | Domain code exists, **not wired** | Not delivered |
| PRD roadmap v0.3 | Rich Deliverables (export/download/preview) | ✅ Fully delivered | — |
| PRD roadmap v0.4/v0.5 | Project Memory / Memory Governance | ✅ Fully delivered | — |
| ARD §5–34 | FileService / GitService (status+diff) / SessionActivityService / WorkingSetService / Drawer (Files/Session/Changes) | Only PreviewService + Activity domain + dead-code drawer | GitService, FileService, WorkingSetService, Drawer UI not delivered |
| ARD §39–41 | Git unit tests, diff integration tests | No corresponding test files | Not delivered |
| ADR-0006 | Working Set follow-up semantics | Domain exists, **not wired** | Not delivered |
| ADR-0009 | Panel consolidation (Artifacts + Memory) | ✅ | But does not document the removal of v0.1 features |
| README | Describes Artifacts + Memory | ✅ Matches current state | — (does not mention dropped features) |

**Conclusion: the v0.1 PRD envisions "Read + Inspect + Scope"; the actual v0.2–v0.5 delivery converged to two scenarios: "Artifacts + Memory". The gap between them is not documented anywhere.**

---

## 6. Closed-Issue Tracking

All 63 Issues are closed, and PR #33/#64 are merged. Cross-referencing each one, **no regressions were found**, but there are 5 "closed but not fully implemented" Issues:

| Issue | Claimed | Actual state |
| --- | --- | --- |
| #31 Implement Working Set follow-up delivery | Closed | `followup.ts` exists but **is never referenced** → not implemented |
| #42 Expose Pinned Context in Workspace Web/Host UX | Closed | Only a snapshot RPC (stores a client-supplied value); no UI, no injection → partially implemented |
| #43 Add deterministic Pinned Context policy and state | Closed | Domain state machine exists ✅, but not wired |
| #44 Refresh Pinned Context from evidence and lifecycle | Closed | `context-refresh.ts` exists but has **no consumers** → not implemented |
| #45 Connect Pinned Context to the public Harness context carrier | Closed | `registerPinnedContextCarrier` is **never called** → not implemented |
| #18 Conversation drawer Workspace shell | Closed | `workspace-drawer.ts` is a pure reducer only, no UI rendering → partially implemented |

**Conclusion**: v0.2 (Pinned Context) and Working Set (#30/#31) are the biggest gap areas — docs and domain code are complete but were never connected to the final product. All Memory- and Artifact-related Issues (#47–#63) are faithfully implemented, and the browser evidence (v0.5 final release evidence) matches.

---

## 7. Potential Issues (by severity)

### High
1. **Diff / Changes feature entirely absent** (the user's main concern): no Git execution, no RPC, no UI. If this is an intentional scope cut, state it in the README/ADR; if not, it is unfinished work.
2. **Broken summary-card data flow**: `workspace/summary` is never emitted, and the "Open Workspace" event has no listener — the chat card may be non-functional.

### Medium
3. **`memoryMarkUsed` not wired** → last-used feature broken (see M1).
4. **Multiple dead-code modules**: `context-carrier.ts`, `context-refresh.ts`, `followup.ts`, `metrics.ts`, `createWorkspaceDrawerController`, `memoryClose`, `memoryMarkUsed`. They cost test/maintenance effort and mislead people into thinking the features exist.
5. **Outdated PRD/ARD**: the PRD is still the v0.1 MVP spec (F20 still says Future); the v0.2–v0.5 scope is only recorded in research/ADR docs, with no updated PRD.

### Low
6. Conflict merge not implemented (M3); dual Pin buttons confusing (M4); surface invisible without a session (M5); `withLock` 2-attempt limit (M7).

---

## 8. Recommendations (by priority)

### P0 (the user's reported pain points)
1. **Add the Diff/Changes view** (or explicitly declare it removed): add `gitStatus` + `diff(path)` RPCs on the Host (`git status --porcelain=v1 -z` + `git diff -- <path>`, passing paths as process args, bounded output — the recipe is in ARD §16); add a third "Changes" tab to the panel that shows a unified diff on click. If it is deemed out of scope, record the decision in the README and an ADR.
2. **Wire up the summary-card data flow**: emit `workspace/summary` (with filesTouched/changes/artifacts counts) from `WorkspaceService` (or the host-side activity update point), and have the `workspace/open` event open the panel (or have the card button operate the `<details>` directly).

### P1 (Memory completeness)
3. **Wire up `memoryMarkUsed`**: wrap it in the client adapter and call it on view/select in the surface, so `useCount`/`lastUsedAt` take effect (v0.5 explicitly requires last-used information).
4. **Wire up `memoryClose`**: release stores on session switch/end to avoid long-lived accumulation.
5. **Clean up dead code**: remove or explicitly mark `context-carrier/context-refresh/followup/metrics/drawer controller` and the unused RPCs; either wire and test what remains, or delete it and record in an ADR why v0.2/Working Set were not delivered.

### P2 (quality)
6. Update the PRD to the v0.5 reality (or add a "delivered vs not delivered" matrix); add an ADR documenting the v0.1 feature cuts.
7. Show a degraded notice when the Memory surface has no session (instead of being fully invisible).
8. If `gitStatus`/`diff` are added, cover them with the ARD §39/§40 test requirements (Git unit tests, diff integration tests, security tests).
9. Consider merging/removing the dual Pin buttons; make the `withLock` stale threshold dynamic.

---

## 9. Appendix: Method & Evidence

- Docs read: README, CONTEXT.md, PRD, ARD, 9 ADRs, 18 research evidence docs
- Code reviewed: all 27 `src/*.ts` files (domain/host/web/client/index)
- Verification run: `npm test` (116 passed), `git status`, `git log`
- GitHub tracking: 63 closed Issues, 2 PRs (#33/#64, both merged), 0 open Issues
- Not run: `npm run build` / `smoke:compat` (evidence docs state they pass; this was a static review + unit tests)

---

## 10. Follow-up Investigation (2026-08-16)

Follow-up to the first review, requested by the user. Four questions were
investigated: (a) moving the Workspace entry next to the Trajectory tab,
(b) improving the Artifact/Memory UI, (c) why Memory must be created manually
instead of by the Agent, and (d) why Memory Export returns empty.

### 10.1 Workspace button placement: a tab next to Trajectory is feasible

**Current state.** The Workspace entry is a floating pill (`<summary>Workspace`)
registered into the `shell.overlay` slot, anchored bottom-right of the app
(`workspace-panel.ts`). It has no badge, no icon, and lives outside the
conversation chrome, so it is easy to miss. The chat summary card (the other
entry point) is effectively dead because `workspace/summary` is never emitted
(see §4.4).

**Harness mechanism (verified against the pinned source
`47f943859…`).** The conversation view ring is a public, additive slot:

```ts
// deepseek-harness: packages/client/ui-conversation/src/client/contract/slots.ts
'conversation.view': { kind: 'list'; scope: 'session'; owner: ConvViewOwnerProps }
// "one list entry per view tab (chat here; trajectory/waterfall from
//  ui-trajectory), rendered one-at-a-time by the session body via only: <active id>"
```

Trajectory itself is a first-party tab registered exactly this way:

```ts
// deepseek-harness: packages/client/ui-trajectory/src/client/index.ts
ctx.slots.inject('conversation.view', () => ctx.slots.register({
  name: 'conversation.view', id: 'trajectory', order: 10,
  label: () => t('view.trajectory'), inject: (sessionId) => ({...}),
}, TrajectoryView))
```

Tab identity is `ViewTab { id, label }`; the active view id is persisted per
session (`ChatStoreState.view`, unknown ids fall back to the stable Chat view).

**Conclusion.** A third-party plugin can register its own
`conversation.view` entry (e.g. `id: 'dsh-workspace'`, `order: 20`) and the
tab renders in the same row as Chat / Trajectory. This is the recommended way
to make Workspace prominent. Two practical notes:

- The `conversation.view` SlotMap row is declared by
  `@deepseek-ai/dsh-client-ui-conversation`, which is **not currently a
  dependency** of this plugin (only `dsh-client-ui-primitives` and
  `dsh-client-ui-slots` are). It should be added as a devDependency for the
  types (runtime works regardless — the harness app declares the slot, and
  the current code already uses structural casts for `shell.overlay`).
- Alternative for a lighter touch: `conversation.session.header.actions`
  (additive per-session header button, renders beside the title by ascending
  `order`). This gives a button without replacing the view ring.

### 10.2 Artifact / Memory UI assessment and concrete optimizations

**Current state.** Both surfaces are functional but bare:

- Artifacts: flat `<ul>` of buttons (name + `mediaType · size · preview`),
  auto-selected first item, preview rendered in place; no grouping, no icons,
  no status badge, no manual refresh, no empty-state guidance beyond a status
  line, no artifact-count summary on the entry.
- Memory: flat list of buttons plus long summary strings, a full inline
  editor, governance `<dl>`, conflict comparison rendered as raw text
  articles; no content preview in the list, no verification/type badge, no
  search-as-you-type, no side-by-side diff for conflicts.
- Panel: plain `<details>` pill + 440px drawer; tabs are bare radio labels.

**Concrete optimization proposals** (ordered by impact):

1. **Register a `conversation.view` tab** (§10.1) and put the panel content
   directly in the tab; drop or de-emphasize the bottom-right pill. Add a
   count badge to the tab label (e.g. `Workspace · 3 artifacts`).
2. **Group artifacts by type** as the PRD specifies (Documents / Data /
   Images / Other), with type icons and a status badge (available /
   unsupported / oversized / stale), plus a manual refresh control and a
   richer empty state ("No session artifacts yet — ask the agent to create
   a file").
3. **Memory list → card list**: show title, one-line content preview, and
   verification/type/scope badges; keep the editor collapsible; add
   search-as-you-type and a record counter; show a "proposal" style for
   `model-suggested` records.
4. **Conflict view → real side-by-side diff**: reuse the preview renderer
   (two `CodeBlock`s side by side) instead of raw text articles, with
   keyboard-selectable choose/merge actions (merge itself is still not
   implemented, see M3).
5. **Empty states everywhere**: explicit guidance instead of bare status
   lines; e.g. Memory tab shows "No records — Memory is only created
   manually today; agent proposals are not implemented (see §10.3)."

### 10.3 "Why do I have to Create Memory?" — agent-driven Memory is not implemented

**Verified findings:**

- The **only caller** of `memoryUpsert` in the whole repo is the Web surface
  (`workspace-memory-surface.ts` → `client.ts` adapter → Host RPC). There is
  **no agent-side creation path**.
- The plugin registers **no agent tools** (no `ctx.tools.register`, no
  `tools/result` hook, no `systemPrompt.section`), so the Agent has no way to
  propose or write Memory.
- `dsh-agent` and `dsh-system-prompt` (rc.6) expose **no Memory surface** for
  a plugin to hook into.
- The v0.4/v0.5 decision docs explicitly anticipated model involvement —
  "model-suggested" is a provenance `origin`, "Model suggestions are
  proposals, never authority", and every imported/derived/model-suggested
  record must start `unverified` with a source reference — but **no
  implementation ever creates such records**. The editor hardcodes
  `provenance: { kind: "user" }`.

**Conclusion.** Memory is 100 % manual today. The design intent (Agent
suggests, user verifies) exists on paper but was never wired. Recommended
implementation: (1) register a system-prompt section + a small Host-side
tool/hook so the Agent can emit structured memory proposals; (2) the Host
turns proposals into `origin: "model-suggested"`, `verification:
"unverified"` records with `sourceRefs` (session/event identity); (3) the UI
renders them as review items with Verify / Reject (the governance state
machine and `importMemoryBundle` already handle this pattern, so most of the
machinery exists).

### 10.4 Memory Export is empty — verified, not a bug

A domain-level script (`/tmp/dsh-mem-verify.ts`, run with Node 22
`--experimental-strip-types`) exercised `WorkspaceMemoryDomain` directly:

| Scenario | Result |
| --- | --- |
| Export on an empty store | `{"schemaVersion":1,"exportedAt":…,"records":[]}` (59 bytes) — valid empty bundle |
| Create a record, then export | Bundle contains the full record (631 bytes, includes id/hash/provenance/governance) |
| `markUsed` then `forget`, export | Record excluded (tombstone) — 59 bytes again |

**Conclusion.** The export logic is correct. An empty export simply means the
store was empty — which is exactly what §10.3 predicts: nothing but the user
ever creates records, so a fresh session/project exports `records: []`.
Additional nuance: new user-authored records start `verification:
"unverified"` and require an explicit Verify action in the UI before they are
eligible to be pinned.

**Related seams that are still dead** (from §3.2): `memoryMarkUsed` and
`memoryClose` RPCs are registered Host-side but never wrapped in the client
adapter or called by the surface — so `useCount`/`lastUsedAt` never update
from the UI, and per-session stores are never released.
