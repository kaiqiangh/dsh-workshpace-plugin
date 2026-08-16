# DSH Workspace — Product Requirements Document (PRD)

**Product:** DSH Workspace  
**Package / Repository:** `dsh-workspace-plugin`  
**Status:** Delivered (v0.5 line) — this revision reflects the shipped reality  
**Last Updated:** 2026-08-16  

## 0. Delivered-Reality Revision (2026-08-16)

This PRD originally specified a full read-only workspace browser plus a v0.1 Working Set and a v0.2 context-management roadmap. The shipped plugin (all tickets merged to `dev`, release pending a `dev → main` review) delivers a narrower, higher-value surface. Section-level deltas:

| Spec section | Delivered reality |
|---|---|
| §7.1 File Explorer (P0) | **Not shipped.** Replaced by §7.5 agent-created Artifacts (the plugin surfaces session-created deliverables, not a general file tree). |
| §7.2 Session Files (P0) | **Partially shipped as activity summary.** The Workspace summary card and the Artifacts list reflect session tool records; there is no full session-file tree. |
| §7.3 File Preview (P0) | **Shipped** as bounded, opaque previews of agent-created artifacts (ADR-0005). |
| §7.4 Changes View (P0) | **Shipped** (git status/diff via typed RPCs; Changes tab in panel and conversation view). |
| §7.5 Agent-Created Artifacts (P0) | **Shipped**, including grouping, type badges, refresh, download, and rich empty state. |
| §7.6 Working Set (P0) | **Retired** — ADR-0010 (the v0.2 Working Set scaffolding was removed; no working-set feature shipped). |
| §7.7 Chat File Links (P1) | Not shipped; the conversation Workspace tab and summary card cover the primary entry points. |
| Project Memory + governance | **Shipped beyond the original roadmap** (v0.4/v0.5): session/project/user/shared-project scopes, provenance-first governance (verify/reject/pin/stale/reverify/archive/forget), export/import, conflict handling, Agent-driven proposals (§ new: 7.8). |
| Conversation integration | **Shipped beyond the original roadmap**: Workspace registers as a `conversation.view` tab beside Trajectory (id `dsh-workspace`), plus the floating panel pill as fallback, plus a live summary card (`workspace/summary` events). |

**Entry points today:** (1) Workspace conversation tab (primary), (2) the `shell.overlay` panel pill (fallback), (3) the summary card's Open Workspace button.

## 1. Executive Summary

DSH Workspace is a workspace companion for DeepSeek Harness that gives users direct visibility into the files an agent reads, creates, and modifies during a session. It provides agent-created artifact inspection with rich bounded previews, Git change inspection, session-aware activity summaries, governed project Memory, and — via the `workspace_memory_propose` tool — Agent-driven Memory proposals the user reviews before they become eligible for context.

The product addresses a practical usability gap in coding-agent workflows: agents can manipulate files effectively, but users often have to rely on shell commands or ask the agent where files were written, what changed, and which outputs were created. DSH Workspace makes the agent's working environment inspectable without turning Harness into a full IDE.

### Product tagline

> See what your agent is working on.

### Product principle

> Help humans understand and control the agent's working environment without replacing the agent's existing filesystem capabilities.

---

## 2. Problem Statement

A typical coding-agent interaction looks like:

```text
User
  ↓
Chat with Agent
  ↓
Agent reads files
Agent edits files
Agent runs scripts
Agent generates outputs
  ↓
Agent says: "Done. I created output/report.md"
```

At this point, the user commonly still needs answers to questions such as:

- Where is the file?
- Which files did the agent actually inspect?
- Which files did the agent modify or create?
- What does the generated Markdown, JSON, CSV, image, or PDF look like?
- What is the current Git diff?
- Were some files already modified before the agent started?
- Which files should the agent focus on next?

Today, users frequently solve these problems through commands such as:

```bash
ls
git status
git diff
cat output/report.md
```

or by asking the agent to perform additional inspection work.

These interactions add friction, consume agent turns, and make it harder for the user to understand what happened during the session.

---

## 3. Product Goals

DSH Workspace must allow a user to answer five questions without leaving the Harness UI:

1. What files exist in the current workspace?
2. What files has the current agent session touched?
3. What files were created, modified, or deleted?
4. What does a file or change look like?
5. Which files should the agent focus on next?

The MVP should create a clear workflow:

```text
Agent works
   ↓
Workspace observes
   ↓
User inspects files / outputs / changes
   ↓
User selects relevant files
   ↓
Working Set is sent back to Agent
   ↓
Agent continues
```

---

## 4. Non-Goals

The MVP is intentionally not a full IDE or general memory platform.

The following are out of scope for v0.1:

- Editing and saving project files from the Workspace UI
- Rename / move / delete operations
- Git staging, commit, revert, branch management
- Integrated terminal
- File upload
- Remote storage browsing
- Google Drive / OneDrive integration
- Vector database
- Semantic code search
- Long-term memory engine
- Team collaboration
- Cloud sync
- AI code review
- Full-text indexing database
- Office document editing
- Arbitrary binary preview
- Automatic injection of full file content into every model request

The MVP should remain primarily:

> Read + Inspect + Scope

---

## 5. Target Users

### Primary user

Developers using DeepSeek Harness for coding and repository work, including:

- Feature implementation
- Debugging
- Codebase investigation
- Refactoring
- Documentation
- Data analysis
- Test generation
- Script execution
- Repository maintenance

### Common generated artifacts

The MVP should particularly support workflows where the agent creates or modifies:

- Source code
- Markdown reports
- JSON outputs
- CSV datasets
- Log files
- Images
- PDFs
- Configuration files

---

## 6. User Experience Overview

The product should expose a Workspace entry point from the Harness conversation UI.

A compact Workspace summary card should show:

```text
Workspace

8 session files
3 changes
2 artifacts

[Open Workspace]
```

Opening Workspace displays a drawer, modal, or overlay with three primary tabs:

```text
Files | Session | Changes
```

and a preview area for the currently selected file.

Illustrative layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ DeepSeek Harness                                             │
├──────────────────────────────┬───────────────────────────────┤
│                              │ Workspace                     │
│ Chat                         │                               │
│                              │ Files | Session | Changes     │
│ Agent:                       │                               │
│ "I've generated..."         │ src/                          │
│                              │   api.ts                      │
│ [Open Workspace]             │   auth.ts                M    │
│                              │ tests/                        │
│                              │ output/                       │
│                              │   report.md              N    │
│                              │   results.csv            N    │
├──────────────────────────────┤───────────────────────────────┤
│ Prompt                       │ Preview                       │
│                              │                               │
│                              │ # Analysis Report             │
│                              │ ...                           │
└──────────────────────────────┴───────────────────────────────┘
```

---

## 7. MVP Scope

### 7.1 File Explorer — P0

The Workspace must provide a read-only tree rooted at the current Harness working directory.

Required capabilities:

- Expand/collapse directories
- Lazy directory loading
- File/folder icons or type indicators
- File size
- Modification time
- Git status indicator when available
- Click a file to preview it
- Manual refresh
- Support Git and non-Git directories

Default excluded paths should include:

```text
.git/
node_modules/
.venv/
dist/
build/
__pycache__/
.cache/
coverage/
```

Users should be able to configure additional excludes.

Example configuration:

```yaml
workspace:
  exclude:
    - node_modules/**
    - .git/**
    - dist/**
```

#### Acceptance criteria

- Opening the workspace must not recursively scan the entire repository.
- Expanding a directory loads only that directory's immediate children.
- Excluded directories do not appear by default.
- Opening a valid file stays within the configured workspace root.

---

### 7.2 Session Files — P0

The Session tab differentiates DSH Workspace from a generic file browser.

It should track files touched by the current agent session and classify activity as:

- READ
- MODIFIED
- CREATED
- DELETED

Example:

```text
Session Files

CREATED
  output/report.md
  output/chart.png

MODIFIED
  src/auth.py
  tests/test_auth.py

READ
  pyproject.toml
  src/config.py
  README.md
```

A compact timeline should also be available:

```text
09:42  READ       src/auth.py
09:43  READ       src/config.py
09:45  MODIFIED   src/auth.py
09:46  CREATED    tests/test_auth.py
09:48  CREATED    output/report.md
```

#### Acceptance criteria

- Known filesystem tools contribute deterministic file activity.
- Repeated reads may be coalesced in the summary view.
- Pre-existing dirty files are distinguishable from agent-introduced changes.
- Files created indirectly by shell commands can be discovered through Git/filesystem observation.

---

### 7.3 File Preview — P0

The preview pane renders files based on type.

#### Code / Text

Supported examples:

- `.py`
- `.ts`
- `.tsx`
- `.js`
- `.jsx`
- `.go`
- `.rs`
- `.java`
- `.cs`
- `.sh`
- `.yaml`
- `.yml`
- `.toml`
- `.txt`
- `.log`

Capabilities:

- Syntax highlighting
- Line numbers
- Search within preview
- Word wrap toggle
- Copy path
- Copy content

#### Markdown

Modes:

- Rendered
- Source

Default mode: Rendered.

#### JSON

Modes:

- Tree
- Raw

Invalid JSON should fall back gracefully to text or show a local parse error without breaking Workspace.

#### CSV

Render a bounded table preview.

Default:

- Maximum preview rows: 1,000
- Indicate truncation

#### Images

Support:

- PNG
- JPEG
- WebP
- GIF
- SVG, only with a safe rendering strategy

Capabilities:

- Fit to container
- Zoom
- Display original dimensions

#### PDF

PDF preview is part of the MVP.

Important scope boundary:

> PDF preview does not mean PDF becomes a DeepSeek model attachment in v0.1.

The Workspace only needs to render a local PDF securely.

#### Acceptance criteria

- Preview reads are bounded by configurable size limits.
- Unsupported files show metadata and a clear unsupported-preview state.
- A malformed file never crashes the entire Workspace UI.

---

### 7.4 Changes View — P0

When the workspace is a Git repository, the Changes tab must show current changes.

Example:

```text
Changes

M src/auth.py
M tests/test_auth.py
A output/report.md
```

Clicking a file opens a unified diff preview.

Required support:

- Working tree changes
- Staged changes
- Added files
- Modified files
- Deleted files
- Renamed files where detected
- Untracked files in the status list

MVP is read-only.

Explicitly excluded:

- Stage
- Unstage
- Commit
- Revert

#### Acceptance criteria

- Git status refreshes after relevant agent mutations.
- Existing pre-session dirty state is not automatically attributed to the agent.
- Diff is limited to files inside the workspace root.

---

### 7.5 Agent-Created Artifacts — P0

The MVP does not introduce a separate complex artifact system.

An artifact is defined as:

> A previewable file created by the agent during the current session.

Artifacts are derived from Session Files and grouped by type.

Example:

```text
Artifacts

Documents
  output/report.md

Data
  output/results.csv
  output/summary.json

Images
  output/chart.png
```

No LLM-based artifact classification is required.

#### Acceptance criteria

- Newly created previewable files appear automatically.
- Deleting an artifact updates the current session state.
- Artifact classification is deterministic and file-type based.

---

### 7.6 Working Set — P0 (RETIRED)

> **Status: retired** — ADR-0010 (2026-08-16). The v0.2 Working Set scaffolding was removed from the tree before shipping; no working-set feature ships in the v0.5 line. Task-scope control is provided instead by the user's explicit verify/pin of Memory records and by normal conversation steering.

The original (unshipped) spec:

Users can pin files into a session-scoped Working Set.

Example:

```text
Working Set

✓ src/auth.py
✓ src/token.py
✓ tests/test_auth.py
```

Available actions:

- Pin
- Unpin
- Clear
- Send to Agent

In v0.1, Working Set represents a **scope hint**, not automatic raw context injection.

When the user chooses Send to Agent, DSH Workspace should send a message similar to:

```text
Use the following files as the active working set for this task:

- src/auth.py
- src/token.py
- tests/test_auth.py

Inspect these files as needed before continuing.
```

This avoids forcing potentially large files into context while still giving the user deterministic control over task scope.

#### Acceptance criteria (historic — not shipped)

- Working Set is scoped to the current session.
- Duplicate paths are not stored.
- Maximum number of pinned files is configurable.
- Send to Agent creates exactly one user-controlled follow-up/steering action.

---

### 7.7 Chat File Links — P1

> **Status: not shipped.** The conversation Workspace tab (primary) and the summary card cover the primary entry points; clickable chat file links remain out of scope for the current release.

---

### 7.8 Agent-Driven Memory Proposals — P0 (shipped beyond original roadmap)

The Agent can propose durable project decisions, preferences, conventions, or facts through the registered `workspace_memory_propose` tool. Proposals are stored as governed `model-suggested` / `unverified` records with session (+ tool-call event) source references and are **never injected into Agent/model context** until the user verifies them. A system-prompt section (tool-guidance band) tells the Agent when and how to propose. The Memory surface shows proposals as review items with Verify / Reject.

When an assistant message contains a workspace-relative path such as:

```text
src/auth.py
```

or:

```text
src/auth.py:83
```

DSH Workspace should detect it and provide an Open action.

Opening the path should:

- Open Workspace
- Select the file
- Navigate to the requested line when present

This is P1 and can ship shortly after the initial MVP if integration complexity is higher than expected.

---

## 8. Functional Requirements

| ID  | Requirement                          | Priority |
| --- | ------------------------------------ | -------- |
| F01 | Lazy workspace file tree             | P0       |
| F02 | Secure text/binary file read         | P0       |
| F03 | Code/text preview                    | P0       |
| F04 | Markdown rendered preview            | P0       |
| F05 | JSON tree/raw preview                | P0       |
| F06 | CSV table preview                    | P0       |
| F07 | Image preview                        | P0       |
| F08 | PDF preview                          | P0       |
| F09 | Current Git status                   | P0       |
| F10 | Git diff preview                     | P0       |
| F11 | Track session-read files             | P0       |
| F12 | Track session-created/modified files | P0       |
| F13 | Session activity timeline            | P0       |
| F14 | Artifact classification              | P0       |
| F15 | Working Set pin/unpin                | P0       |
| F16 | Send Working Set to Agent            | P0       |
| F17 | Chat path links                      | P1       |
| F18 | Context token estimation             | P1       |
| F19 | True pinned-context injection        | v0.2     |
| F20 | Memory browser                       | Future   |

---

## 9. Configuration Requirements

Recommended default configuration:

```yaml
# .dsh/workspace.yaml

enabled: true
root: "."

files:
  showHidden: false
  exclude:
    - ".git/**"
    - "node_modules/**"
    - ".venv/**"
    - "dist/**"
    - "build/**"
    - "__pycache__/**"

preview:
  maxTextBytes: 2097152
  maxJsonBytes: 5242880
  maxCsvBytes: 10485760
  maxCsvRows: 1000
  maxImageBytes: 20971520
  maxPdfBytes: 52428800

git:
  enabled: true

activity:
  trackReads: true
  trackWrites: true
  trackShellChanges: true
  maxTimelineEvents: 500

workingSet:
  maxFiles: 20
```

### Zero-config requirement

The plugin should work immediately with sensible defaults when no config file exists.

---

## 10. Error Handling Requirements

Workspace must fail locally rather than globally.

Expected error cases include:

- Permission denied
- File deleted between list and preview
- Unsupported binary type
- Invalid JSON
- Malformed CSV
- File too large for preview
- Git unavailable
- Non-Git directory
- Path traversal attempt
- Symlink escaping workspace root
- Unsafe SVG
- PDF preview failure

The UI should render an error state inside the affected view while keeping the rest of Workspace usable.

---

## 11. Security Requirements

The MVP is read-only with respect to project files.

All filesystem accesses must:

1. Normalize the requested path.
2. Resolve it relative to the configured workspace root.
3. Resolve the real filesystem path.
4. Verify that the target remains within the real workspace root.
5. Re-check containment at actual read/open time where applicable.

The implementation must account for:

- `..` traversal
- Absolute paths
- Symlinks
- Junctions
- Windows case-insensitive paths
- UNC paths when relevant
- File replacement races

The browser must not be given arbitrary host filesystem paths as direct resource URLs.

---

## 12. Performance Requirements

### File tree

- Must use lazy loading.
- Must not recursively index the repository on startup.

### Git

- Git status refresh should be debounced.
- Recommended refresh delay: 300–500 ms after relevant mutations.

### Preview

- Read a file only when the user opens it.
- Check file size before reading content into memory.
- CSV and JSON parsing must be bounded.

### Session activity

- Repeated reads should be coalesced where practical.
- Default maximum timeline length: 500 events.

---

## 13. Success Metrics

The first release should focus on usage behavior rather than vanity metrics.

### Workspace Open Rate

Percentage of coding sessions where the user opens Workspace.

### Preview Rate

Percentage of agent-touched files that are previewed by the user.

### Artifact Open Rate

Percentage of agent-created previewable artifacts that the user opens.

### Memory Review Rate

Percentage of model-suggested Memory proposals that the user reviews (verify or reject) — a direct signal of whether the proposal tool stays useful.

### Working Set Usage (RETIRED)

> **Status: retired** with §7.6 (ADR-0010). Replaced by the Memory Review Rate above.

Percentage of sessions in which users pin one or more files and send a Working Set back to the agent.

### Inspection Shell Avoidance

Track reduction in purely inspection-oriented commands such as:

```text
ls
cat
git status
git diff
```

when Workspace is available.

This metric is particularly useful because it measures whether the product eliminates unnecessary agent/tool interactions.

---

## 14. MVP Definition of Done

The MVP is complete when the following end-to-end scenario works:

### Step 1 — Start Harness

```bash
dsh web
```

inside a Git repository.

### Step 2 — Give Agent a task

```text
Investigate the authentication bug, fix it, and write a short report.
```

### Step 3 — Agent activity

The agent:

```text
reads:
  src/auth.py
  src/token.py

modifies:
  src/auth.py

creates:
  tests/test_auth.py
  output/report.md
```

### Step 4 — Open Workspace

The Session tab displays:

```text
Read
  src/auth.py
  src/token.py

Modified
  src/auth.py

Created
  tests/test_auth.py
  output/report.md
```

### Step 5 — Inspect Changes

The Changes tab displays:

```text
M src/auth.py
A tests/test_auth.py
```

Opening `src/auth.py` shows the file and its current Git diff.

### Step 6 — Inspect Artifact

Opening `output/report.md` renders the Markdown report.

### Step 7 — Control Agent Scope

> **Status: retired** — the Working Set flow was removed (ADR-0010). The shipped equivalent for durable scope control is governed Memory: the user verifies/pins records, which makes them eligible for later use; task-level steering remains ordinary conversation.

The user pins:

```text
src/auth.py
tests/test_auth.py
```

and selects **Send to Agent**.

The agent receives a follow-up identifying those files as the active Working Set.

If the complete scenario works safely and reproducibly, v0.1 is considered shippable.

---

## 15. Roadmap

> **Delivery status added 2026-08-16.** The v0.5 line is delivered on `dev` (release pending review); the v0.1 Working Set and v0.2 context-management items were retired (ADR-0010).

### v0.1 — Workspace Visibility (delivered, Working Set excepted)

- Files — **not shipped** (replaced by agent-created Artifacts)
- Session Files — **partial** (activity summaries via summary card / Artifacts list)
- Preview — **shipped** (bounded opaque previews of agent-created artifacts)
- Changes — **shipped**
- Artifacts derived from session-created files — **shipped**
- Working Set — **retired (ADR-0010)**

### v0.2 — True Context Management (RETIRED — ADR-0010)

- ~~Pin to model context~~
- ~~Token estimation~~
- ~~Context budget~~
- ~~Content hash~~
- ~~Refresh-on-change~~
- ~~Context provenance~~

### v0.3 — Rich Deliverables (delivered)

- Better artifact UX — **shipped** (grouping, badges, refresh, download, empty states)
- Export/download — **shipped** (bounded resource route)
- Additional preview types — **shipped** (code/text, markdown, JSON, CSV, images, PDF, binary)
- Generic file attachment integration — **not shipped** (out of scope)

### v0.4 — Project Memory (delivered)

- Project decisions — **shipped**
- Preferences — **shipped**
- Conventions — **shipped**
- Important persistent facts — **shipped**

### v0.5 — Memory Governance (delivered)

- Memory provenance — **shipped**
- Session / Project / User scopes — **shipped** (+ shared-project opt-in)
- Edit / Forget / Pin — **shipped**
- Last-used information — **shipped** (memoryMarkUsed on view)
- Conflict handling — **shipped** (two-column comparison, verify/reject)
- Agent-driven proposals — **shipped** (§7.8, `workspace_memory_propose` tool + system-prompt section)

---

## 16. Product Positioning

DSH Workspace should not be positioned as another file explorer or another memory plugin.

Its core positioning is:

> A human-control layer over the agent's working environment.

The product should make it immediately obvious:

- what the agent looked at,
- what it changed,
- what it produced,
- and what the user wants it to focus on next.

---

## v0.2 Change Notes (2026-08-16)

- **Entry simplification:** the redundant lower-right floating panel (`shell.overlay`) was removed; the `Workspace` tab is the only entry.
- **Overview density:** the per-session summary card (chat) now shows files by kind (created/modified/deleted), artifact count, active-scope memory/decision counts, and the active time span — all host-derived from durable tool records, no Agent involvement.
- **Memory auto-write:** a session auto-writer (`attachWorkspaceMemoryAutoWriter`) observes `tools/result`, debounces per session, and writes `derived`/`unverified` `fact` records (stable id, idempotent merge, max 6 per session with oldest archived) so Memory and Export carry useful session facts. Storage details: `docs/MEMORY_STORAGE.md`.
- **Surface redesign:** Artifacts / Memory / Changes use a shared scoped visual system (cards, status badges, empty/loading/error states) via `src/web/workspace-styles.ts`; remote contracts unchanged.
