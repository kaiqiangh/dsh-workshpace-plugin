# Bound v0.1 support and privacy

**Status:** accepted

DSH Workspace v0.1 guarantees the read-only inspection workflow in `dsh web` on the operating systems and browser matrix supported by the pinned DeepSeek Harness release. It does not expand that matrix or promise a transport-neutral implementation. A local workspace is required; remote, SSH, container, and alternate client-carrier workspaces are deferred until a supported host/resource transport exists.

Git and non-Git roots are both supported. Git status and diff are conditional on Git availability; non-Git roots still provide the file tree, session activity, previews, and Working Set. P1 chat path links, arbitrary binary preview, true context injection, and file mutation remain deferred or unsupported in v0.1. Zero-config operation is required with safe defaults and bounded reads.

The browser receives workspace-relative paths and opaque resource identifiers only. The Workspace remains project-file read-only, and no file contents, absolute host paths, or network telemetry leave the local Harness process by default. v0.1 metrics are local-first aggregate counts only; external product analytics and causal claims about shell-command reduction are deferred.
