# DSH Workspace Plugin

DSH Workspace adds a focused Workspace panel to the local DeepSeek Harness Web UI. It lets you inspect the files an agent touched, review session artifacts, preview bounded content, and manage local Workspace Memory without leaving the conversation.

## What it is for

Harness sessions can produce useful files and state while an agent is working, but that information should not take over the chat layout. This plugin keeps the Workspace experience compact and session-aware:

- one collapsed `Workspace` entry keeps the main UI clear;
- a responsive side panel groups `Artifacts` and `Memory` in tabs;
- artifact previews, Working Set actions, and Memory controls stay inside the panel;
- the panel uses scoped styles so it does not change the Harness shell globally.

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
4. Select `Workspace` in the lower-right corner.
5. Use `Artifacts` to inspect session outputs and `Memory` to review or edit local notes.

The panel opens as a desktop drawer and uses the full available width on a narrow screen. Select the close button or the browser disclosure control to return to the compact entry.

## Develop and verify locally

```sh
npm test
npm run check
npm run build
npm run smoke:compat
```

`npm run build` writes the runnable package bundle to `lib/`. The Web profile loads that bundle when the plugin is registered.

## Troubleshooting

- **The panel is missing:** rebuild the plugin, restart `dsh web`, and add the plugin again if the local profile was created before the build.
- **The old overlapping layout is still visible:** an older Web process is serving a cached bundle; stop it and run `npx @deepseek-ai/dsh web` again.
- **Artifacts or Memory are empty:** open Workspace from an active Harness session; the panel reads session-scoped data rather than a global file list.
- **The command cannot find the plugin:** run the add command from the Harness project and use the correct relative path to this repository.

Project terms are defined in [`CONTEXT.md`](CONTEXT.md), and architecture decisions are recorded in [`docs/adr/`](docs/adr/).
