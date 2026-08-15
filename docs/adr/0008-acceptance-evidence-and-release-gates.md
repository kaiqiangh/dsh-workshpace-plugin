# ADR-0008: Acceptance Evidence and Release Gates

## Status

Accepted for v0.1 planning.

## Context

The PRD and ARD define a read-only, local-first Workspace that observes a
Harness session, exposes bounded previews and changes, and sends an explicit
Working Set continuation. A release decision needs observable evidence across
the supported dsh web carrier without turning optional capabilities into
release-wide failures.

## Decision

Release evidence is organized into gates. Each gate records the fixture,
observable assertion, and command or host run that produced the evidence.

### Blocking gates

1. **Compatibility** — the pinned Harness source/package baseline loads the
   Host and Web faces, accepts one Agent-scoped JSON request, serves one
   bounded resource route, renders one conversation node, and removes all
   registrations on disposal. The exact upstream baseline and package lock
   are part of the evidence. A missing required carrier or unverified
   out-of-tree Typert build blocks release; no source-mode or untyped fallback
   may be claimed as compatibility evidence.
2. **Core behavior** — deterministic tests cover Workspace identity and root
   containment, lazy file access, config defaults and validation, bounded
   previews, Session Activity projections, Artifacts, Changes, Working Set
   state, and local aggregate metrics.
3. **Security and privacy** — adversarial fixtures cover traversal, absolute
   and Windows paths, symlink/junction escapes, deleted-file races, opaque
   resource tampering, oversized inputs, malicious SVG, and absolute-path or
   content leakage. The UI remains read-only and metrics remain local with no
   network export.
4. **Harness integration** — Git and non-Git fixtures cover successful and
   unavailable Git, public tool-result attribution, durable replay/resume,
   shell-created and deleted files, and one deterministic follow-up delivery
   for a Working Set. The end-to-end PRD scenario must show the expected
   Session, Changes, Preview, Artifact, and Working Set states.
5. **Supported host UX** — the conversation node and drawer expose Files,
   Session, and Changes with keyboard-reachable controls, focus return on
   close, relative paths only, and local panel errors for unsupported or stale
   resources.

### Graceful-degradation evidence

The following are documented and tested as local states rather than release
failures: non-Git roots, missing or invalid Git, optional renderer failure,
malformed configuration fields, deleted files between listing and preview,
unsupported binary types, and a resource that exceeds its configured bound.
The core Files, Session, Preview metadata, Artifacts, and Working Set remain
usable where their own capability is available.

### Operational thresholds

The budgets in ADR-0007 are the release thresholds: mandatory excludes,
bounded preview bytes/rows, timeline and coalescing limits, Working Set size,
lazy listing, one in-flight Git refresh with trailing debounce, and disposal
of timers, routes, watchers, and resource identifiers. Startup must not build
a recursive repository index. No new latency target is invented for v0.1;
host evidence must show that these ceilings are respected.

### Evidence sources and matrix

- Node built-in tests and type/syntax checks are the authoritative deterministic
  unit evidence.
- Temporary Git and non-Git fixtures are authoritative for filesystem and
  capability behavior; pre-existing dirty state is explicitly seeded.
- The pinned installed Harness bundle is authoritative for Host/Web,
  conversation-node, resource-route, and disposal evidence.
- The supported Harness OS/browser matrix is run for the compatibility and UX
  gates. A platform-specific optional failure is recorded as degradation only
  when the core behavior and security gates still pass.

## Consequences

Release claims become evidence-backed and reproducible. Optional services can
degrade without hiding core inspection, while compatibility, security,
privacy, attribution, replay, and read-only guarantees remain hard blockers.
The compatibility smoke path remains intentionally blocked until the
out-of-tree Typert client/build recipe is resolved (tracked by the existing
compatibility issue).

## Out of scope

Electron or alternate carriers, remote roots, editing or Git mutation,
uploads, arbitrary binary preview, P1 chat links, true context injection,
network analytics, and persistent memory are not release gates for v0.1.
