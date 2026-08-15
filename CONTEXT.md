# DSH Workspace

DSH Workspace is a read-only, session-aware inspection surface over the files an agent works with. Its domain is bounded by one Harness Session and one canonical Workspace Root.

## Language

**Workspace**:
The read-only inspection surface for one Harness Session and one Workspace Root. It exposes file state, session activity, changes, artifacts, previews, and a user-controlled Working Set.
_Avoid_: file explorer, IDE, memory browser

**Workspace Root**:
The canonical filesystem directory that bounds a Workspace. The configured root is resolved from the Harness process working directory and is never widened by a browser or event path; client and durable identity use an opaque root identifier rather than the host path.
_Avoid_: project root, host path

**Workspace Path**:
A normalized, workspace-relative logical path used by the host/client contract and session state. It is not an absolute host filesystem path.
_Avoid_: file URL, absolute path

**Harness Session**:
The durable Harness conversation execution scope that owns Workspace state. A resumed Harness Session retains its Workspace identity and durable activity; a different session starts a new Workspace lifecycle.
_Avoid_: browser session, request

**Session Baseline**:
The point-in-time repository state captured for a Harness Session to distinguish pre-existing changes from later evidence. It is attribution metadata, not a full content snapshot.
_Avoid_: initial checkout, file snapshot

**Session Activity**:
A deterministic observation that a Workspace Path was read, created, modified, or deleted during a Harness Session. Activity records evidence and may outlive the current file.
_Avoid_: assistant narration, audit log

**Session File**:
The aggregated per-path state derived from Session Activity for the current Harness Session, including paths that no longer exist.
_Avoid_: currently open file, changed file

**Workspace Change**:
The current Git or filesystem change state of a Workspace Path relative to the repository/workspace state being inspected. It is independent of whether the agent caused the change.
_Avoid_: Session Activity, agent change

**Artifact**:
A previewable file created during the current Harness Session. Artifact listings are derived from Session Files and reflect current existence; activity history can still record deletion.
_Avoid_: attachment, deliverable

**Working Set**:
An ordered, duplicate-free, session-scoped list of Workspace Paths chosen by the user as a scope hint for a subsequent agent continuation. It does not inject file contents automatically.
_Avoid_: pinned context, model context

**Workspace Support Boundary**:
The v0.1 set of Workspace capabilities guaranteed for a supported DeepSeek Harness Web host and its supported host operating systems. It does not imply support for remote workspaces, alternate client carriers, or a broader browser/OS matrix than Harness itself provides.
_Avoid_: universal workspace support, remote filesystem

**Local-first Metric**:
An aggregate Workspace interaction count that may be inspected or exported locally without sending paths, file contents, or telemetry to a service by default.
_Avoid_: analytics profile, remote tracking

**Compatibility Baseline**:
The exact DeepSeek Harness source revision and resolved package versions against which a Workspace release is verified. A baseline is a release input, not a floating version range.
_Avoid_: latest Harness, compatible enough

**Host/Web Adapter**:
The narrow Workspace boundary that translates the public Harness Host, Web, session, and conversation seams into Workspace operations while keeping Harness-specific lifecycle and transport details out of the domain.
_Avoid_: private Harness hook, core-loop patch

**Activity Attribution**:
The evidence label attached to Session Activity: agent-evidenced, session-observed, pre-existing, or unknown. Attribution never upgrades a Git/filesystem observation into agent causality without direct tool evidence.
_Avoid_: agent-owned change, author

**Evidence Source**:
The public observation seam that produced Session Activity, such as a final tool outcome, native durable tool event, Git reconciliation, or filesystem observation. Source identifies how an observation was learned, not who caused it.
_Avoid_: assistant claim, audit trail

**Preview Policy**:
The type-, size-, and content-safety rules that determine whether a Workspace Path is rendered as text, structured data, a bounded resource, metadata-only, or a local error.
_Avoid_: file viewer, attachment policy

**Opaque Resource**:
A short-lived, session- and root-bound identifier that authorizes one bounded binary preview without exposing a host filesystem path to the browser.
_Avoid_: file URL, attachment id
