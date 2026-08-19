# DSH Workspace Plugin

DSH Workspace adds a `Workspace` tab to the local DeepSeek Harness Web UI. It lets you inspect what an agent touched, review session artifacts, preview bounded content, inspect Git changes, manage governed local Workspace Memory, and review Memory proposals the Agent creates — all without leaving the conversation.

## What it is for

Harness sessions can produce useful files and state while an agent is working, but that information should not take over the chat layout. This plugin keeps the Workspace experience compact and session-aware:

- a `Workspace` tab beside `Trajectory` in the conversation view row (the only entry);
- a session summary block at the top of the Workspace tab that shows what the agent touched (files by kind, artifacts, memory/decision counts, active span) — derived on demand, so it works identically for live and reopened sessions;
- tabbed surfaces: `Artifacts`, `Memory`, and `Git` on a shared visual system (auto-refresh, friendly empty/error states, keyboard-operable); the Git tab hosts the Changes and History views;
- artifact previews (grouped by type, searchable, with per-item size · modified-time · status and one-click download, copy-path) including a read-only multi-tab preview, markdown previews that render relative images and mermaid diagrams, and streaming PDF previews; Memory governance controls, and readable Git inspection stay inside the surfaces;
- Memory is auto-written per session as derived facts, so Export carries useful information;
- Git: a repo-status header (branch, dirty/clean, staged / unstaged / untracked counts, ahead/behind), Changes grouped into staged / unstaged / untracked sections with filterable status and readable unified/split diffs, and a commit History (commit list + per-commit files/diff); non-Git workspaces show a clean "not a Git repository" state;
- the surfaces use scoped styles so they do not change the Harness shell globally;
- all displayed copy is available in English and Chinese and follows the Harness app language (browser language is only the fallback).

## Install the plugin

Build the plugin from this repository:

```sh
npm install
npm run build
```

Register the built plugin with a local Harness checkout. Run this from the Harness project directory, or adjust the relative path to where this repository is checked out:

```sh
dsh plugin --profile web add ../dsh-workshpace-plugin
```

The command stores the Web plugin registration in the local Harness profile.

## Start the Web UI

```sh
dsh web
```

Open [http://127.0.0.1:3080/](http://127.0.0.1:3080/) in a browser. Restart the Web UI after rebuilding the plugin so it loads the latest bundle.

## Use Workspace

1. Open the Harness Web UI and select a model.
2. Choose or create a Workspace-backed session.
3. Start the conversation and let the agent create or inspect files.
4. Open the `Workspace` conversation tab.
5. Use the tabs:
   - `Artifacts` — inspect session-created deliverables (grouped by type, searchable by name) with bounded previews beside the list, per-item size · modified-time · preview status, copy-path, and one-click download;
   - `Memory` — review, create, verify, pin, archive, or forget project/session Memory records, review Agent proposals (`model-suggested` items show as unverified until you Verify or Reject them), and see session facts the auto-writer derived from agent activity;
   - `Git` — repo-status header (branch + short head, dirty/clean, staged / unstaged / untracked counts, ahead/behind), then a **Changes / History** switch: Changes shows working-tree and staged changes (auto-refreshing, grouped into staged / unstaged / untracked sections, filterable by status) with colored, line-numbered unified diffs, `+N −M` stats, and a copy-diff control; History shows the commit list and a per-commit files/diff detail.

The Workspace tab renders the three surfaces in a card-based layout with scoped styles; the summary block above the tabs tracks the same session facts.

## Develop and verify locally

```sh
npm test
npm run check
npm run build
npm run smoke:compat
```

`npm run build` writes the runnable package bundle to `lib/`. The Web profile loads that bundle when the plugin is registered. The build also copies the mermaid vendor bundle into `lib/assets/` so the host can serve diagrams same-origin.

## Troubleshooting

- **The Workspace tab is missing:** rebuild the plugin, restart `dsh web`, and add the plugin again if the local profile was created before the build.
- **The old floating panel is still visible:** an older Web process is serving a cached bundle; stop it and run `npx @deepseek-ai/dsh web` again. The redundant lower-right pill was removed in v0.2 — the Workspace tab is the only entry.
- **A historical session created before v0.6 will not reopen:** pre-v0.6 versions persisted a custom `workspace/summary` event into the session log, and DSH's cold persistence path refuses to load logs containing unknown non-ignorable event types. v0.6 stops persisting that event, so new sessions are clean and reopen normally; already-affected logs cannot be safely rewritten (seq continuity), so those specific sessions are not recoverable — delete them or start fresh sessions.
- **Markdown images or mermaid diagrams do not show:** the plugin serves them through the same-origin opaque resource route and a vendor bundle; if the Web UI was started before a v0.6 rebuild, restart `dsh web` so the new routes (`/workspace/vendor/mermaid.js`, Range/ETag on `/workspace/resource`) are registered.
- **Artifacts or Memory are empty:** open Workspace from an active Harness session; the surfaces read session-scoped data rather than a global file list.
- **Git shows "not a Git repository":** the workspace root is not a Git checkout. Open Workspace from a session whose working directory is a Git repository to see Changes and History.
- **Memory Export downloads an empty bundle (`"records":[]`):** that is expected only when the session had no Memory and no agent file activity. Since v0.2, a session auto-writer derives `fact` records from agent tool activity (files by kind + artifacts), so an active session exports useful facts even without manual records. Manual records are created in the UI or proposed by the Agent via `workspace_memory_propose`; proposals are stored `unverified` until you Verify them. Storage details: [`docs/MEMORY_STORAGE.md`](docs/MEMORY_STORAGE.md).
- **The command cannot find the plugin:** run the add command from the Harness project and use the correct relative path to this repository.

Project terms are defined in [`CONTEXT.md`](CONTEXT.md), and architecture decisions are recorded in [`docs/adr/`](docs/adr/). Product/architecture documents: [`docs/DSH_Workspace_PRD.md`](docs/DSH_Workspace_PRD.md) and [`docs/DSH_Workspace_ARD.md`](docs/DSH_Workspace_ARD.md).
