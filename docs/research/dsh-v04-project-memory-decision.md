# DSH Workspace v0.4 Project Memory domain and persistence

Decision record for issue #38. It extends the PRD v0.4 Project Memory scope
without changing the v0.1/v0.2 rule that Working Set and Pinned Context are
explicit user actions, not silent model injection. The existing Workspace
identity remains the canonical Session + Root pair from ADR-0001.

## Decision

Use a local-first, append-only JSONL store with a small in-memory index. Keep
storage behind a `MemoryStore` adapter so the domain does not depend on a
database package or on Harness private persistence APIs.

This is the smallest durable option that is inspectable with ordinary tools,
works on the current Node/Host baseline, adds no native dependency, and can
recover valid records when one log line is damaged. SQLite is explicitly not
introduced: no SQLite package is already installed, native `node:sqlite` is
not a pinned cross-baseline contract, and v0.4 does not need a query planner or
multi-process write throughput. Session-only memory is rejected because it
cannot satisfy durable project decisions/preferences/conventions/facts.

## Scope and storage locations

Each scope has an explicit store and identity key:

| Scope | Identity key | Default location | Meaning |
| --- | --- | --- | --- |
| Session | Harness `sessionId` + Workspace `rootId` | Host session sidecar under `DSH_HOME` | Facts visible only to one durable session/root pair. |
| Project | canonical Workspace `rootId` | project-local `.dsh/workspace-memory/records.jsonl` (ignored by default) | Local decisions/preferences/conventions for this checkout. |
| User | explicit user profile id | `DSH_HOME/workspace-memory/user.jsonl` | User preferences that may apply across projects. |
| Shared Project | canonical Workspace `rootId` plus explicit opt-in | project-local `.dsh/workspace-memory/shared.jsonl` | Reviewable, shareable records; never enabled implicitly and never a secret sink. |

Project and Shared Project are separate files so a user can inspect, ignore,
commit, or delete shared records without exposing local state. Session and User
stores use restrictive local permissions where the Host supports them. No
scope is read merely because a file happens to exist: the user must enable the
scope in the Memory UI/configuration.

## Record schema

The v0.4 domain stores metadata and human-readable content, never an opaque
embedding or an unbounded tool payload:

```ts
type MemoryRecord = {
  schemaVersion: 1;
  id: string; // opaque, stable within the store
  scope: "session" | "project" | "user" | "shared-project";
  scopeKey: string;
  type: "decision" | "preference" | "convention" | "fact";
  title: string;
  content: string;
  tags: readonly string[];
  provenance: {
    kind: "user" | "agent" | "tool" | "import";
    sessionId?: string;
    eventSeq?: number;
    note?: string;
  };
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
  contentHash: `sha256:${string}`;
  status: "active" | "archived" | "forgotten";
};
```

Writes validate the scope key, type, bounded title/content/tags, timestamps,
and SHA-256 content hash before append. Updates append a new complete record
with the same `id`; the latest valid record wins. Forget is a tombstone (`status:
"forgotten"`), not physical deletion, until an explicit compaction action.
Conflict presentation is intentionally not auto-resolved in v0.4; v0.5
governance owns provenance precedence and conflict rules.

## Lifecycle and retrieval contract

The public Host domain is deliberately separate from model context:

```text
open(scope, identity) -> MemoryReadState
list(scope, filters) -> metadata + bounded content
upsert(draft, explicitUserAction) -> MemoryRecord
archive(id) / forget(id) -> tombstone
search(query, scopes, limit) -> ranked MemorySearchResult[]
markUsed(id) -> updated last-used metadata
close() -> flush/close store
```

`open` validates project identity and loads only active records into a bounded
index. `search` is deterministic and local: exact title/phrase matches first,
then token overlap over title/content/tags, then prefix matches, with
`updatedAt`, `lastUsedAt`, and `id` as stable tie-breakers. It caps query
length, token count, content returned per record, and result count. No vector
index, network search, or model-generated ranking is introduced in v0.4.

Memory UI must show the scope, provenance, timestamps, hash prefix, and the
exact records selected before any future model use. v0.4 does not inject search
results, records, or summaries into an Agent prompt; the only path to model
context remains an explicit v0.5-governed action.

## Project identity and failure behavior

- Derive `rootId` from the canonical real path using the existing Workspace
  identity helper. A moved, renamed, symlink-changed, or inaccessible root is
  not silently rebound to another directory.
- If the configured root is missing or inaccessible, open returns a typed
  `PROJECT_UNAVAILABLE` state and leaves records untouched. The UI can offer an
  explicit rebind/import flow later; it must not scan parent directories.
- If the root exists but its canonical `rootId` differs, treat it as a new
  Project. Session records fail closed with the existing root mismatch rule.
- User-scope records remain available when a project is unavailable, but the UI
  labels them User scope and never pretends they are Project facts.

## Corruption, migration, and retention

- Read JSONL line by line. Valid records remain usable when a line is malformed,
  has an unknown enum, fails its content hash, or violates the size bound.
  Invalid lines are copied to a timestamped `.corrupt` sidecar and surfaced as
  a local warning; they are never silently discarded.
- Unknown future `schemaVersion` files open read-only with a typed
  `UNSUPPORTED_SCHEMA` warning. They are not rewritten by an older client.
- Known migrations are pure, monotonic functions (`v1 -> v2 -> ...`) applied to
  a temporary file, fsynced, then atomically renamed. The previous file is
  retained as a backup until the next successful open.
- Compaction is explicit or threshold-triggered, writes a complete latest-state
  snapshot to a temporary file, and atomically replaces the log. A failed
  write leaves the previous store and marks the new mutation unsaved.
- Records are not expired automatically in v0.4. Archive/forget and any
  retention or conflict policy are explicit governance inputs for v0.5.

## Acceptance-test outline

The v0.4 implementation must prove, with a temporary project and user profile:

1. Records round-trip with stable IDs, content hashes, provenance, timestamps,
   and `useCount`/`lastUsedAt` updates across process restarts.
2. Session, Project, User, and opt-in Shared Project reads cannot cross their
   scope keys; a root move/mismatch returns a typed unavailable state.
3. Deterministic search ranks exact/token/prefix matches consistently and
   respects result/content/query bounds without network or model calls.
4. A malformed line, bad hash, truncated file, and unknown schema preserve
   valid records, produce visible warnings, and never overwrite the original.
5. Upsert, archive, forget, migration, and compaction are atomic under a
   simulated write failure; no partial record is observed.
6. The Web surface renders provenance/scope before use and proves that opening
   or searching Memory does not call the Agent, followup, context provider, or
   model injection seam.

## Rejected alternatives and upgrade trigger

- In-memory/session-only maps fail durability and restart acceptance.
- SQLite or a new embedded database fails the no-new-dependency and pinned
  cross-platform baseline; reconsider only when concurrent writers, query
  volume, or full-text indexing is measured to exceed JSONL bounds.
- Reusing Harness session events for Memory fails because custom durable event
  vocabulary is not a public carrier on the pinned release (ADR-0004).
- Silent prompt injection, automatic conflict resolution, and implicit shared
  storage are deferred to v0.5 Memory Governance.

Re-run this decision when Harness changes its public persistence/session APIs,
Workspace identity rules, or the supported Host/Web carrier.
