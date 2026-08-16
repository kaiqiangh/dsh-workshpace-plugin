# ADR 0010: Retire v0.2/Working Set scaffolding that never shipped

- Status: Accepted
- Date: 2026-08-16

## Context

The v0.1–v0.5 delivery converged on two user-facing scenarios: the Artifacts
browser (v0.3) and governed local Memory (v0.4/v0.5), plus the new Git
Changes/Diff view (v0.6). The v0.1 PRD also specified a Files tree, a Session
Files tab, a Working Set, and chat path links, and the v0.2 roadmap specified
Pinned Context. Domain scaffolding for those features was written (drawer
reducer, Pinned Context state/carrier/refresh, Working Set follow-up, local
metrics) but never wired into the shipped Web surface. A codebase review
(foundings §4.3/§7) found those modules were dead code that misled about
shipped features and carried test/maintenance cost.

## Decision

Remove the scaffolding that is not reachable from the shipped UI and record
why it was never delivered:

- Deleted: `domain/context.ts`, `domain/context-carrier.ts`,
  `domain/context-refresh.ts` (Pinned Context), `domain/followup.ts`
  (Working Set follow-up delivery), `domain/metrics.ts` (unused local
  metrics), `web/workspace-drawer.ts` and `createWorkspaceDrawerController`
  (the unreachable four-tab drawer reducer), and their tests.
- Kept: the session-activity/observation domain (it feeds Artifact
  derivation and the summary emitter), the `contextSnapshot`/
  `replaceContext` Host RPCs (a stable, harmless snapshot carrier), and all
  shipped surfaces.

## Why Pinned Context and Working Set were not delivered

The v0.2/v0.1 scope assumed a drawer with Files/Session/Changes/Context tabs
and a Working Set steering action. The pinned Harness baseline
(`47f943859…`, npm `0.1.0-rc.6`) made the public `conversation.view` slot the
natural home for Workspace, and the shipped product prioritized Artifacts,
Memory, and (v0.6) Git Changes. Working Set and Pinned Context remain
**explicitly out of scope** of this effort (map "Wayfinder: Deliver DSH
Workspace v0.6 review hardening", Out of scope); if they are ever redrawn
into scope they should be rebuilt against the shipped tab surface, not
resurrected from this scaffolding.

## Consequences

The public `./client` and root exports no longer include the drawer
controller or Pinned Context/Working Set helpers; consumers on the previous
prerelease must migrate. The package surface is smaller and honest about
what ships.
