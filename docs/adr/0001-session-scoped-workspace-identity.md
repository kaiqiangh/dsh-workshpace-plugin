# Bind Workspace identity to Session and Root

**Status:** accepted

DSH Workspace identity is the pair of the durable Harness Session and the canonical Workspace Root. This prevents a resumed session or a changed configuration from silently reinterpreting workspace-relative paths, while preserving the local-first, read-only boundary; a root change starts a distinct Workspace lifecycle rather than migrating path state implicitly.
