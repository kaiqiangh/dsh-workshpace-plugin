# DSH Workspace — Architecture Requirements Document (ARD)

**Product:** DSH Workspace  
**Package / Repository:** `dsh-workspace-plugin`  
**Status:** MVP Architecture Specification  
**Target Release:** v0.1  
**Last Updated:** 2026-08-15  

## 1. Architecture Summary

DSH Workspace is implemented as a read-only, session-aware workspace layer for DeepSeek Harness. The plugin observes agent tool activity through public Harness extension points, provides secure filesystem and Git read services, derives session file activity, exposes preview data to a Web client contribution, and allows users to send a selected Working Set back to the agent.

The architecture must avoid modifying the Harness agent loop and must not depend on undocumented internal behavior when a public extension seam exists.

### Core architecture principle

```text
Agent writes files
Workspace observes files
User inspects files
User selects scope
Agent continues
```

The Workspace is not responsible for becoming an IDE, a source-control client, or a memory engine in v0.1.

---

## 2. Architecture Goals

The MVP architecture must satisfy the following goals:

1. Do not modify the Harness `agent-loop`.
2. Use public Harness extension points whenever possible.
3. Keep project-file access read-only from the Workspace UI.
4. Maintain session awareness.
5. Support replay/resume of session activity where durable events are used.
6. Remain local-first.
7. Require no separate database.
8. Work in Git and non-Git directories.
9. Stay provider-neutral.
10. Enforce a strict workspace-root security boundary.
11. Avoid recursive repository scans during startup.
12. Keep memory/context features modular for future expansion.

---

## 3. Relevant DeepSeek Harness Extension Model

The implementation should be based on documented Harness extension patterns:

- `ctx.tools.register()` for tool registration
- `tools/pre-execute` for gates
- `tools/execute` for dispatch wrappers
- `tools/post-execute` for result transformation
- `tools/result` for observation of the final immutable tool outcome
- `session/event` for durable session event observation
- `ConversationNodeDefinition` for Web conversation contributions
- `conversation.chat.node` for keyed Web rendering
- `ctx.systemPrompt.section()` and `agent.inject()` for later context features
- `Agent.followup()` / `Agent.steer()` for user-controlled continuation

The MVP should not add behavior directly inside the core agent loop.

---

## 4. High-Level Architecture

```text
┌─────────────────────────────────────────────┐
│             DeepSeek Harness                │
│                                             │
│ Agent                                       │
│   │                                         │
│   ├── filesystem read                       │
│   ├── edit/write                            │
│   ├── bash / subprocess                     │
│   │                                         │
│   ▼                                         │
│ Tool Execution Pipeline                     │
│   │                                         │
│   └── tools/result                          │
│             │                               │
│             ▼                               │
│     Workspace Activity Tracker              │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│             Workspace Core                  │
│                                             │
│ WorkspaceService                            │
│ FileService                                 │
│ GitService                                  │
│ SessionActivityService                      │
│ PreviewService                              │
│ WorkingSetService                           │
│ WorkspaceSecurityBoundary                   │
└─────────────┬───────────────────────────────┘
              │
              │ typed host/client API
              ▼
┌─────────────────────────────────────────────┐
│             Workspace Web                   │
│                                             │
│ Workspace Conversation Node                 │
│ Workspace Drawer / Overlay                  │
│                                             │
│ ┌────────┬─────────┬─────────┐              │
│ │ Files  │ Session │ Changes │              │
│ └────────┴─────────┴─────────┘              │
│                                             │
│ Preview Renderer Registry                   │
│ Working Set UI                              │
└─────────────────────────────────────────────┘
```

---

## 5. Recommended Packaging Strategy

For MVP speed, use one external repository and one distributable plugin package.

Suggested structure:

```text
dsh-workspace-plugin/
│
├── package.json
├── README.md
├── LICENSE
├── cordis.patch.yml
│
├── src/
│   ├── index.ts
│   │
│   ├── core/
│   │   ├── workspace-service.ts
│   │   ├── config.ts
│   │   └── errors.ts
│   │
│   ├── filesystem/
│   │   ├── resolver.ts
│   │   ├── list-directory.ts
│   │   ├── stat.ts
│   │   └── resource.ts
│   │
│   ├── activity/
│   │   ├── tracker.ts
│   │   ├── tool-observer.ts
│   │   ├── baseline.ts
│   │   └── git-observer.ts
│   │
│   ├── git/
│   │   ├── status.ts
│   │   └── diff.ts
│   │
│   ├── preview/
│   │   ├── registry.ts
│   │   ├── text.ts
│   │   ├── markdown.ts
│   │   ├── json.ts
│   │   ├── csv.ts
│   │   ├── image.ts
│   │   └── pdf.ts
│   │
│   ├── working-set/
│   │   └── service.ts
│   │
│   ├── session/
│   │   ├── events.ts
│   │   └── state.ts
│   │
│   └── web/
│       ├── plugin.ts
│       ├── WorkspaceNode.tsx
│       ├── WorkspaceDrawer.tsx
│       ├── FileTree.tsx
│       ├── SessionFiles.tsx
│       ├── ChangesView.tsx
│       ├── WorkingSet.tsx
│       └── preview/
│           ├── PreviewPane.tsx
│           ├── CodePreview.tsx
│           ├── MarkdownPreview.tsx
│           ├── JsonPreview.tsx
│           ├── CsvPreview.tsx
│           ├── ImagePreview.tsx
│           └── PdfPreview.tsx
│
└── tests/
    ├── filesystem.test.ts
    ├── resolver-security.test.ts
    ├── activity.test.ts
    ├── git.test.ts
    ├── previews.test.ts
    ├── working-set.test.ts
    └── integration/
```

Do not prematurely split into multiple npm packages unless Harness packaging requirements force that separation.

---

## 6. Core Service Contract

A central Workspace service should provide the application-level API.

```ts
interface WorkspaceService {
  root(): WorkspaceRoot;

  listDirectory(
    path: WorkspacePath
  ): Promise<WorkspaceEntry[]>;

  stat(
    path: WorkspacePath
  ): Promise<WorkspaceFileStat>;

  preview(
    path: WorkspacePath
  ): Promise<PreviewDescriptor>;

  changes(): Promise<WorkspaceChange[]>;

  diff(
    path: WorkspacePath
  ): Promise<FileDiff>;

  sessionActivity(
    sessionId: SessionId
  ): readonly WorkspaceActivity[];

  workingSet(
    sessionId: SessionId
  ): readonly WorkspacePath[];
}
```

The UI should consume this service indirectly through a typed host/client boundary rather than importing filesystem code into browser bundles.

---

## 7. Workspace Path Model

The browser must deal in workspace-relative logical paths, not arbitrary host paths.

```ts
type WorkspacePath = string & { readonly __brand: "WorkspacePath" };
```

A path such as:

```text
src/auth.py
```

is valid.

A browser-provided path such as:

```text
../../etc/passwd
```

must fail before filesystem access.

The host is authoritative for path resolution.

---

## 8. File Data Model

```ts
interface WorkspaceEntry {
  path: string;
  name: string;

  kind:
    | "file"
    | "directory"
    | "symlink";

  size?: number;
  modifiedAt?: number;

  gitStatus?:
    | "modified"
    | "added"
    | "deleted"
    | "untracked"
    | "renamed";

  sessionStatus?:
    | "read"
    | "modified"
    | "created"
    | "deleted";
}
```

The UI should not infer Git/session state independently. It should receive normalized status from the host.

---

## 9. Filesystem Service

Responsibilities:

- Resolve workspace-relative paths.
- Enforce security boundary.
- Read metadata.
- List immediate directory children.
- Read bounded file content.
- Open validated binary resources.
- Apply exclude rules.
- Avoid recursive scans.

Suggested interface:

```ts
interface FileService {
  list(path: WorkspacePath): Promise<WorkspaceEntry[]>;
  stat(path: WorkspacePath): Promise<WorkspaceFileStat>;
  readText(path: WorkspacePath, limit: number): Promise<TextReadResult>;
  openResource(path: WorkspacePath): Promise<WorkspaceResource>;
}
```

---

## 10. Workspace Security Boundary

This is a critical architecture component.

Every user-, agent-, event-, or UI-derived path must go through the same resolver.

Required algorithm:

```text
input workspace-relative path
        ↓
normalize logical path
        ↓
reject obvious invalid/absolute form when not allowed
        ↓
resolve against configured workspace root
        ↓
realpath parent/target as applicable
        ↓
perform boundary-aware containment check
        ↓
read/open
```

The implementation must handle:

- `..`
- Absolute paths
- Symbolic links
- Junctions
- Windows path casing
- UNC paths where relevant
- Deleted files
- Renamed files
- File replacement races

Do not rely only on:

```ts
resolvedPath.startsWith(workspaceRoot)
```

because string-prefix containment is insufficient.

Use path-segment-aware comparison and real filesystem paths.

### TOCTOU

Containment should be revalidated as close as practical to actual file open/read.

For sensitive resource reads, prefer opening after canonical path validation and avoid long gaps between validation and use.

---

## 11. Directory Listing

Directory listing must be lazy.

Prohibited MVP behavior:

```text
startup
  ↓
recursive walk entire repository
  ↓
build complete file index
```

Required behavior:

```text
open Workspace
  ↓
list root children
  ↓
user expands src/
  ↓
list src/ children
```

This keeps startup cost predictable for large repositories.

---

## 12. Session Activity Architecture

Session activity must be derived deterministically rather than from assistant narration.

Do not use statements such as:

```text
"I modified src/auth.py"
```

as authoritative tracking evidence.

Use two complementary mechanisms.

### Layer 1 — Tool Observation

Observe final tool outcomes using the Harness tool pipeline.

Relevant activity examples:

```text
read(path)   → READ
write(path)  → CREATED or MODIFIED
edit(path)   → MODIFIED
```

The exact tool names and schemas must be discovered from the installed Harness composition rather than hardcoded blindly.

The observer should normalize recognized tool calls into `WorkspaceActivity` records.

### Layer 2 — Git / Filesystem Observation

Shell commands can create or modify files without explicit file paths in tool arguments.

Example:

```bash
python generate_report.py
```

may create:

```text
output/report.csv
output/chart.png
```

Therefore, after potentially mutating tools:

```text
tool completes
   ↓
debounce
   ↓
Git status or filesystem change observation
   ↓
compare against session baseline/current state
   ↓
emit created/modified/deleted activity
```

For Git repositories, Git status is the preferred MVP source.

For non-Git workspaces, use a lightweight filesystem watcher only if required for indirect mutation detection.

---

## 13. Session Baseline

At session start, capture a lightweight baseline.

Do not hash every file.

Suggested model:

```ts
interface WorkspaceBaseline {
  sessionId: string;
  startedAt: number;
  gitHead?: string;
  gitStatus?: Map<string, GitStatus>;
}
```

Purpose:

```text
pre-existing dirty state
        vs
agent-introduced mutation
```

Example:

```text
Before session:
  M README.md

During session:
  M README.md
  M src/auth.py
```

Workspace should not automatically claim that `README.md` was modified by the agent unless there is additional evidence.

---

## 14. Session Activity Data Model

```ts
interface WorkspaceActivity {
  id: string;
  sessionId: string;
  path: string;

  action:
    | "read"
    | "created"
    | "modified"
    | "deleted";

  source:
    | "tool"
    | "git-observation"
    | "filesystem";

  toolName?: string;
  timestamp: number;
}
```

Summary state should also track aggregated information:

```ts
interface SessionFileState {
  path: string;
  firstSeenAt: number;
  lastSeenAt: number;
  readCount: number;
  created: boolean;
  modified: boolean;
  deleted: boolean;
}
```

This prevents the summary UI from needing to replay all raw timeline entries every render.

---

## 15. Durable Session Events

Where session resume/replay is required, use durable workspace event families with stable identities.

Example type design:

```ts
declare module "@deepseek-ai/dsh-session/types" {
  interface SessionEventMap {
    "workspace/session-start": {
      workspaceId: string;
      rootName: string;
    };

    "workspace/activity": {
      activityId: string;
      path: string;
      action:
        | "read"
        | "created"
        | "modified"
        | "deleted";
      timestamp: number;
    };
  }
}
```

The client should rebuild Session state from deterministic durable events where appropriate.

### Event-volume control

Repeated reads should not produce unbounded logs.

Recommended configuration:

```yaml
activity:
  maxTimelineEvents: 500
  coalesceWindowMs: 1000
```

The implementation may coalesce repeated activity while preserving enough information for a meaningful timeline and summary.

---

## 16. Git Service

Suggested service:

```ts
interface GitService {
  isRepository(): Promise<boolean>;

  status(): Promise<GitFileStatus[]>;

  diff(
    path?: WorkspacePath
  ): Promise<string>;

  stagedDiff(
    path?: WorkspacePath
  ): Promise<string>;
}
```

Recommended commands:

```bash
git status --porcelain=v1 -z
git diff -- <path>
git diff --cached -- <path>
```

The Git service should:

- Execute with workspace root as working directory.
- Avoid shell string concatenation with untrusted paths.
- Pass file paths as process arguments.
- Bound output size.
- Normalize statuses before returning to the UI.

Do not reimplement Git diff generation.

---

## 17. Git Refresh Strategy

Do not run Git status on every streamed chunk or every minor event.

Recommended strategy:

```text
potentially mutating tool ends
      ↓
mark Git state dirty
      ↓
300–500 ms debounce
      ↓
refresh status once
```

Multiple closely spaced mutations should coalesce into one refresh.

The UI may also provide explicit manual Refresh.

---

## 18. Preview Architecture

Preview should be provider-based.

```ts
interface PreviewProvider {
  id: string;

  canPreview(
    file: WorkspaceFileStat
  ): boolean;

  describe(
    file: WorkspaceFileStat
  ): Promise<PreviewDescriptor>;
}
```

Recommended providers:

```text
TextPreviewProvider
CodePreviewProvider
MarkdownPreviewProvider
JsonPreviewProvider
CsvPreviewProvider
ImagePreviewProvider
PdfPreviewProvider
FallbackPreviewProvider
```

This allows future formats to be added without changing the Workspace core.

---

## 19. Preview Descriptor

The host should return typed preview data rather than pre-rendered application HTML.

```ts
type PreviewDescriptor =
  | {
      type: "text";
      language?: string;
      content: string;
      truncated: boolean;
    }
  | {
      type: "markdown";
      content: string;
    }
  | {
      type: "json";
      value: unknown;
    }
  | {
      type: "csv";
      columns: string[];
      rows: string[][];
      truncated: boolean;
    }
  | {
      type: "binary";
      mediaType: string;
      resourceId: string;
    }
  | {
      type: "unsupported";
      reason: string;
    };
```

Rendering remains client-side.

Benefits:

- No arbitrary HTML crossing the trust boundary.
- Preview logic remains testable.
- Browser renderer can vary without changing host filesystem logic.

---

## 20. Preview Size Limits

Recommended defaults:

```yaml
preview:
  maxTextBytes: 2097152
  maxJsonBytes: 5242880
  maxCsvBytes: 10485760
  maxImageBytes: 20971520
  maxPdfBytes: 52428800
  maxCsvRows: 1000
```

Implementation rule:

```text
stat file first
   ↓
compare size with configured limit
   ↓
only then read/parse
```

Do not load a large file into memory merely to discover that it exceeds the preview limit.

---

## 21. Code/Text Preview

Host responsibilities:

- Read bounded UTF-8-compatible content.
- Indicate truncation.
- Infer a best-effort language identifier from extension.

Client responsibilities:

- Syntax highlighting
- Line numbers
- Search
- Word wrap
- Copy actions

Do not make syntax highlighting a host dependency.

---

## 22. Markdown Preview

Host returns Markdown source.

Client renders using a Markdown renderer with safe defaults.

Security requirements:

- Raw HTML should be disabled or sanitized.
- Links should not automatically execute local resources.
- Images/embedded resources need a defined policy.

Source mode should render the same content through the code/text renderer.

---

## 23. JSON Preview

Host may parse JSON within configured size limits.

Behavior:

```text
valid JSON
  → structured JSON preview

invalid JSON
  → preview error + optional raw-text fallback
```

Large JSON must not be parsed beyond configured limits.

---

## 24. CSV Preview

CSV parsing must be bounded.

Suggested behavior:

- Parse up to configured byte limit.
- Return up to `maxCsvRows`.
- Detect common delimiters conservatively if desired.
- Indicate truncation.
- Reject pathological row/column expansion using additional parser limits if needed.

The client renders a scrollable table.

---

## 25. Image Preview

Preferred approach:

```text
browser requests resourceId
      ↓
host validates resource authorization/path
      ↓
stream bounded bytes
      ↓
browser creates object URL or direct resource response
```

Supported formats:

- PNG
- JPEG
- WebP
- GIF
- SVG only with a dedicated safe policy

SVG must not be injected as arbitrary HTML.

---

## 26. PDF Preview

PDF preview is a Workspace rendering feature, not a model-input attachment feature.

Preferred client-side implementation:

- Use a browser-compatible PDF viewer/library.
- Fetch PDF bytes through the Workspace resource endpoint.
- Keep the file under the same size/security limits as other binary resources.

The host must not expose arbitrary local filesystem URLs.

---

## 27. Binary Resource Serving

The browser must not receive raw host paths such as:

```text
/home/user/project/secret.pdf
```

Use an opaque resource identifier.

Example logical flow:

```text
Browser
  ↓
workspace.readResource(resourceId)
  ↓
Host validates resourceId
  ↓
resolve associated WorkspacePath
  ↓
workspace-root containment check
  ↓
size/type check
  ↓
stream bytes
```

A resource identifier may be derived from a signed/opaque mapping or content metadata.

Example conceptual identifier:

```text
workspace:sha256:...
```

Do not implement:

```text
GET /file?path=../../etc/passwd
```

---

## 28. Artifact Derivation

MVP artifact detection should be deterministic.

Definition:

```text
Artifact = previewable file created by the agent in the current session
```

Classification examples:

```text
.md      → document
.pdf     → document
.csv     → data
.json    → data
.png     → image
.jpg     → image
```

No LLM call is required.

Artifact state should reuse Session Files rather than create a parallel tracking subsystem.

---

## 29. Working Set Service

Suggested model:

```ts
interface WorkingSet {
  sessionId: string;
  paths: string[];
  updatedAt: number;
}
```

Suggested service:

```ts
interface WorkingSetService {
  list(sessionId: SessionId): readonly WorkspacePath[];
  pin(sessionId: SessionId, path: WorkspacePath): void;
  unpin(sessionId: SessionId, path: WorkspacePath): void;
  clear(sessionId: SessionId): void;
  buildAgentMessage(sessionId: SessionId): string;
}
```

v0.1 stores logical paths only.

It does not persist or inject full file contents automatically.

---

## 30. Send Working Set to Agent

The client action should call a Host operation that uses the owning session Agent handle to send one deterministic scope message.

Example message:

```text
Use the following files as the active working set for this task:

- src/auth.py
- src/token.py
- tests/test_auth.py

Inspect these files as needed before continuing.
```

Use the public continuation APIs available to the composition, such as `followup()` or `steer()`, according to current session state and the desired semantics.

Avoid direct manipulation of internal queues.

---

## 31. Why Full Context Injection Is Deferred

Example Working Set:

```text
src/auth.py       700 lines
src/token.py      900 lines
tests/test_auth.py 1200 lines
```

Automatically inserting all content could produce significant prompt overhead.

Therefore:

```text
v0.1 Working Set = scope hint
v0.2 Context Pinning = bounded content injection
```

Future true context pinning should include:

- Token estimation
- Per-item token size
- Total budget
- Content hash
- Change detection
- Refresh policy
- Provenance
- Explicit user control

---

## 32. Web Client Integration

Preferred Web integration pattern:

```text
workspace durable/session state
        ↓
ConversationNodeDefinition
        ↓
Workspace summary node
        ↓
conversation.chat.node renderer
        ↓
Open Workspace
        ↓
Drawer / modal / overlay
```

The conversation node should contain only renderer-ready summary information, for example:

```text
Files touched: 8
Changes: 3
Artifacts: 2
```

The drawer can maintain ephemeral client-only state such as:

- Selected tab
- Selected file
- Expanded folders
- Preview mode
- Search query

These values do not need durable session events.

---

## 33. Host ↔ Client API

Conceptual API surface:

```text
workspace.listDirectory
workspace.stat
workspace.preview
workspace.readResource
workspace.gitStatus
workspace.diff
workspace.sessionFiles
workspace.workingSet
workspace.pinWorkingSet
workspace.unpinWorkingSet
workspace.sendWorkingSet
```

Implementation requirement:

> Use a documented/public Host/Web extension seam if one exists in the target Harness version.

Do not monkey-patch undocumented internal RPC registries.

Before coding this boundary, perform an implementation spike against the current DeepSeek Harness revision to identify the supported Host/client API mechanism used by first-party client features.

If the public third-party RPC seam is not stable enough, isolate the compatibility code in one adapter module so the rest of Workspace remains independent.

---

## 34. Conversation Node State

The Workspace summary node should be derived from stable business state and use a stable node identity.

Suggested view data:

```ts
interface WorkspaceChatData {
  filesTouched: number;
  changes: number;
  artifacts: number;
  workspaceName: string;
}
```

The renderer should consume node data directly rather than scan the entire session history on every render.

---

## 35. Error Model

Use a typed application error.

```ts
interface WorkspaceError {
  code: WorkspaceErrorCode;
  message: string;
  path?: string;
}
```

Possible codes:

```text
PATH_OUTSIDE_WORKSPACE
FILE_NOT_FOUND
PERMISSION_DENIED
FILE_TOO_LARGE
UNSUPPORTED_PREVIEW
INVALID_JSON
INVALID_CSV
GIT_UNAVAILABLE
NOT_A_GIT_REPOSITORY
RESOURCE_INVALID
RESOURCE_EXPIRED
SYMLINK_ESCAPE
INTERNAL_ERROR
```

The client should handle errors locally within the affected component.

---

## 36. Configuration Model

Recommended config:

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
  coalesceWindowMs: 1000

workingSet:
  maxFiles: 20
```

The config loader should validate values on startup and fall back to safe defaults where appropriate.

---

## 37. Read-Only Enforcement

v0.1 Workspace core must not expose project file mutation operations to the browser.

No API for:

- write
- rename
- delete
- move
- chmod
- stage
- commit
- revert

The only mutable plugin state is internal Workspace state such as:

- Working Set
- UI preferences where applicable

This boundary reduces both implementation complexity and security risk.

---

## 38. Performance Requirements

### Startup

- No full repository indexing.
- No recursive file hashing.
- Baseline collection should be lightweight.

### File Tree

- Lazy listing.
- Optional short-lived caching per directory.
- Cache invalidation on refresh or observed mutations.

### Git

- Debounced refresh.
- Bound subprocess output.
- Avoid duplicate concurrent Git status calls.

### Preview

- Lazy read.
- Size check before read.
- Bounded parsers.
- Binary resources streamed where practical.

### Session Activity

- Coalesce repeated events.
- Cap timeline length.
- Maintain aggregated per-file state.

---

## 39. Testing Strategy

### Unit Tests — Filesystem

Cover:

- Normal file
- Directory listing
- Hidden file behavior
- Excluded paths
- Large file
- Deleted file
- Symlink
- Symlink escape
- `../` traversal
- Absolute path
- Windows path variants

### Unit Tests — Preview

Cover:

- Markdown
- JSON
- Invalid JSON
- CSV
- Oversized CSV
- Code/text
- PNG
- PDF
- Unsupported binary

### Unit Tests — Git

Cover:

- Clean repo
- Modified file
- Added file
- Deleted file
- Renamed file
- Untracked file
- Staged change
- Unstaged change
- Non-Git directory

### Unit Tests — Activity

Cover:

- Read
- Edit
- Write
- Repeated read
- Pre-existing dirty file
- Shell-created file
- Deleted file
- Coalescing
- Timeline limit

### Unit Tests — Working Set

Cover:

- Pin
- Duplicate pin
- Unpin
- Clear
- Maximum file count
- Message formatting

---

## 40. Security Tests

Required adversarial cases:

```text
../../etc/passwd
absolute path outside workspace
symlink → external target
nested symlink escape
junction escape
malicious SVG
huge JSON
huge CSV
huge PDF
renamed file race
file deleted between stat and read
resourceId tampering
```

The test suite should run on at least Linux and one additional platform where practical because filesystem path semantics differ.

---

## 41. Integration Tests

### Scenario A — File Read

Agent reads:

```text
src/auth.py
```

Expected:

```text
Session Files → READ src/auth.py
```

### Scenario B — File Edit

Agent edits:

```text
src/auth.py
```

Expected:

```text
Session Files → MODIFIED src/auth.py
Changes → M src/auth.py
Preview → current file contents
Diff → current Git diff
```

### Scenario C — Indirect Artifact Creation

Agent executes:

```bash
python generate_report.py
```

which creates:

```text
output/report.csv
```

Expected:

```text
Session Files → CREATED output/report.csv
Artifacts → output/report.csv
CSV preview → renders successfully
```

### Scenario D — Working Set

User pins:

```text
src/auth.py
src/token.py
```

and chooses Send to Agent.

Expected:

- Exactly two logical paths in Working Set.
- Agent receives one correctly formatted continuation message.

---

## 42. Implementation Order

### Phase 1 — Core Filesystem

Implement:

- Workspace root
- Path security
- Directory listing
- File stat
- Bounded text read
- Unit tests

Do not start with UI.

### Phase 2 — Preview Layer

Implement:

- Code/text
- Markdown
- JSON
- CSV
- Image
- PDF
- Fallback preview

### Phase 3 — Session Awareness

Implement:

- Tool observation
- Read/write/edit classification
- Session baseline
- Git observation
- Shell-created file detection

### Phase 4 — Changes

Implement:

- Git status
- Working-tree diff
- Staged diff

### Phase 5 — Web Client

Implement:

- Workspace conversation node
- Workspace drawer
- File tree
- Session tab
- Changes tab
- Preview pane

### Phase 6 — Working Set

Implement:

- Pin/unpin
- Session-scoped state
- Send to Agent

---

## 43. Implementation Spikes Required

Because DeepSeek Harness is evolving, complete the following spikes before finalizing code structure.

### Spike A — Exact Tool Names and Result Shapes

Identify current filesystem and shell tool registrations in the target Harness composition.

Confirm:

- Tool names
- Input schemas
- Output/result metadata
- Whether path data can be observed reliably through `tools/result`

### Spike B — Host/Web Extension Seam

Identify the supported public method for a third-party plugin to expose read-only Host services to the built-in Web client.

Confirm:

- Registration API
- Request/response typing
- Session scoping
- Binary response/resource support
- Disposal lifecycle

### Spike C — Existing Deliverables Integration

Inspect current first-party deliverables/client packages and avoid duplicating any capability that can be safely reused.

Define whether Workspace should:

- Reuse existing deliverable rendering,
- Link to it,
- Or keep artifact derivation independent but compatible.

### Spike D — Current Conversation Node Composition

Verify the exact client plugin composition mechanism and package exports required to register the Workspace summary node in the currently targeted Harness version.

---

## 44. Architecture Risks

### Risk 1 — Harness API Churn

DeepSeek Harness is evolving rapidly.

Mitigation:

- Depend only on documented seams.
- Isolate compatibility code.
- Avoid importing deep internal implementation paths.

### Risk 2 — Remote Workspace Semantics

If future Harness deployments separate browser, Host, and execution filesystem, Workspace must treat the Host/execution side as authoritative.

Mitigation:

- Keep filesystem operations host-side.
- Never rely on browser-local paths.

### Risk 3 — Large Repository Performance

Mitigation:

- Lazy tree
- No index
- Bounded previews
- Debounced Git

### Risk 4 — Unsafe File Rendering

Mitigation:

- Typed preview descriptors
- Safe Markdown
- Sandboxed or sanitized SVG
- Dedicated PDF viewer
- No arbitrary HTML from local files

### Risk 5 — Misattributing Pre-existing Changes

Mitigation:

- Session baseline
- Tool-observed evidence
- Separate workspace Git status from agent-attributed activity

---

## 45. Future Architecture Extensions

### True Context Pinning

Add a `ContextItemProvider`-style layer that maps Working Set files into bounded, versioned, token-estimated model context.

Potential data model:

```ts
interface PinnedContextItem {
  path: WorkspacePath;
  contentHash: string;
  estimatedTokens: number;
  lastLoadedAt: number;
}
```

### Project Memory

Memory should be a separate module, not embedded inside FileService.

Potential scopes:

```text
Session
Project
User
Shared Project
```

Memory UI can later live beside Files / Session / Changes without forcing the storage engine into v0.1.

### Remote Filesystem Provider

Future WorkspaceService may depend on a filesystem-provider abstraction:

```ts
interface WorkspaceFileProvider {
  list(...): Promise<...>;
  stat(...): Promise<...>;
  read(...): Promise<...>;
}
```

This would allow local, sandbox, container, or remote execution environments without changing the Web UI.

---

## 46. Architecture Definition of Done

The architecture is considered validated when the following complete flow works without private agent-loop modifications:

```text
Agent reads src/auth.py
   ↓
tools/result observation
   ↓
workspace activity recorded
   ↓
Agent edits src/auth.py
   ↓
Git status refresh
   ↓
Changes view shows M src/auth.py
   ↓
User opens src/auth.py
   ↓
secure preview API returns bounded content
   ↓
User opens diff
   ↓
GitService returns unified diff
   ↓
Agent creates output/report.md
   ↓
Session activity marks CREATED
   ↓
Artifact list exposes report.md
   ↓
Markdown preview renders it
   ↓
User pins auth.py + test file
   ↓
WorkingSetService stores paths
   ↓
Send to Agent
   ↓
public Agent continuation API receives scope message
```

If this is achieved with:

- strict workspace-root containment,
- lazy filesystem access,
- bounded previews,
- read-only project access from the UI,
- public Harness extension points,
- and reproducible session activity,

then the v0.1 architecture is ready for implementation and release.
