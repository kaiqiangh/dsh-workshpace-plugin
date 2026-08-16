# ADR 0009: Use one responsive Workspace panel in the Web shell

- Status: Accepted
- Date: 2026-08-16

## Context

The first Web integration registered Artifacts and Memory as two independent `shell.overlay` entries. The Harness shell renders that slot above the main application, so two full-width plugin surfaces competed for the same space and overlapped the conversation UI. The plugin also had no presentation boundary for its controls and previews.

## Decision

Register one `dsh-workspace-panel` entry in `shell.overlay` and keep Artifacts and Memory inside it as tabs.

- The default state is a compact, collapsed `Workspace` disclosure.
- On desktop, the open panel is a right-side drawer with a bounded width.
- On narrow screens, the drawer uses the available width with small insets.
- Styles are scoped below `data-dsh-workspace` and do not mutate Harness global layout or typography.
- The panel owns one overlay lifecycle and disposes its style tag and remote adapter together.

## Consequences

The Harness conversation remains visible while Workspace is closed, and only one Workspace section is visible at a time when it is open. The panel can still contain the existing artifact and Memory controls without changing their remote contracts. The drawer occupies a small part of the viewport while open, and a single panel becomes the navigation point for future Workspace sections.

## Out of scope

This decision does not change Workspace Root semantics, session identity, artifact or Memory APIs, or the Harness shell itself.
