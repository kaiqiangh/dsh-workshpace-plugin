# DSH Workspace Plugin

DSH Workspace adds a `Workspace` tab to the local DeepSeek Harness Web UI. It lets you inspect what an agent touched, review session artifacts, preview bounded content, inspect Git changes, manage governed local Workspace Memory, and review Memory proposals the Agent creates — all without leaving the conversation.

## What it is for

Harness sessions can produce useful files and state while an agent is working, but that information should not take over the chat layout. This plugin keeps the Workspace experience compact and session-aware:

- a `Workspace` tab beside `Trajectory` in the conversation view row (the only entry);
- a per-session summary card in the chat that shows what the agent touched (files by kind, artifacts, memory/decision counts, active span);
- tabbed surfaces: `Artifacts`, `Memory`, and `Changes` on a shared visual system (auto-refresh, friendly empty/error states, keyboard-operable);
- artifact previews (grouped by type, searchable, with per-item status and one-click download), Memory governance controls, and readable Git diff inspection stay inside the surfaces;
- Memory is auto-written per session as derived facts, so Export carries useful information;
- the surfaces use scoped styles so they do not change the Harness shell globally.

## Install the plugin

Build the plugin from this repository:

```sh
npm install
npm run build
```

Register the built plugin with a local Harness checkout. Run this from the Harness project directory, or adjust the relative path to where this repository is checked out:

```sh
npx @deepseek-ai/dsh plugin --profile web add ../dsh-workshpace-plugin
```

The command stores the Web plugin registration in the local Harness profile.

## Start the Web UI

```sh
npx @deepseek-ai/dsh web
```

Open [http://127.0.0.1:3080/](http://127.0.0.1:3080/) in a browser. Restart the Web UI after rebuilding the plugin so it loads the latest bundle.

## Use Workspace

1. Open the Harness Web UI and select a model.
2. Choose or create a Workspace-backed session.
3. Start the conversation and let the agent create or inspect files.
4. Open the `Workspace` conversation tab.
5. Use the tabs:
   - `Artifacts` — inspect session-created deliverables (grouped by type, searchable by name) with bounded previews beside the list, per-item preview status, and one-click download;
   - `Memory` — review, create, verify, pin, archive, or forget project/session Memory records, review Agent proposals (`model-suggested` items show as unverified until you Verify or Reject them), and see session facts the auto-writer derived from agent activity;
   - `Changes` — working-tree and staged Git changes (auto-refreshing, filterable by status) with colored, line-numbered unified diffs, `+N −M` stats, and a copy-diff control.

The Workspace tab renders the three surfaces in a card-based layout with scoped styles; the chat summary card above the conversation tracks the same session facts.

## Develop and verify locally

```sh
npm test
npm run check
npm run build
npm run smoke:compat
```

`npm run build` writes the runnable package bundle to `lib/`. The Web profile loads that bundle when the plugin is registered.

## Troubleshooting

- **The Workspace tab is missing:** rebuild the plugin, restart `dsh web`, and add the plugin again if the local profile was created before the build.
- **The old floating panel is still visible:** an older Web process is serving a cached bundle; stop it and run `npx @deepseek-ai/dsh web` again. The redundant lower-right pill was removed in v0.2 — the Workspace tab is the only entry.
- **Artifacts or Memory are empty:** open Workspace from an active Harness session; the surfaces read session-scoped data rather than a global file list.
- **Changes is empty:** the workspace root is not a Git repository (or has no working-tree/staged changes). Open Workspace from a session whose working directory is a Git checkout.
- **Memory Export downloads an empty bundle (`"records":[]`):** that is expected only when the session had no Memory and no agent file activity. Since v0.2, a session auto-writer derives `fact` records from agent tool activity (files by kind + artifacts), so an active session exports useful facts even without manual records. Manual records are created in the UI or proposed by the Agent via `workspace_memory_propose`; proposals are stored `unverified` until you Verify them. Storage details: [`docs/MEMORY_STORAGE.md`](docs/MEMORY_STORAGE.md).
- **The command cannot find the plugin:** run the add command from the Harness project and use the correct relative path to this repository.

Project terms are defined in [`CONTEXT.md`](CONTEXT.md), and architecture decisions are recorded in [`docs/adr/`](docs/adr/). Product/architecture documents: [`docs/DSH_Workspace_PRD.md`](docs/DSH_Workspace_PRD.md) and [`docs/DSH_Workspace_ARD.md`](docs/DSH_Workspace_ARD.md).
