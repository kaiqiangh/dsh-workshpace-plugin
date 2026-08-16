# v0.4 Project Memory implementation evidence

Fixed SHA: `5f25a05`

- JSONL append-only `MemoryStore` covers Session, Project, User, and explicit Shared Project scopes.
- Validation is bounded and hash checked; malformed lines quarantine, unknown schemas are read-only, migrations compact atomically, and concurrent compaction reloads before replacement.
- Project memory rejects missing roots, root-escaping symlink paths, and stores larger than 8 MiB.
- `WorkspaceMemoryDomain` keys stores by scope and identity, and the agent-scoped Host methods expose CRUD/search/last-used without Agent or model calls.
- Governance/export/import additions are included in the same fixed SHA for the v0.5 dependency chain.

Evidence: 109 Node tests, `npm run check`, `npm run build`, `npm pack --dry-run`, `npm run smoke:compat`, and `git diff --check` pass. The installed `dsh web` gate boots the pinned rc.6 shell with no console/page errors, but cannot create a session/workspace without an API key in this environment; carrier-backed interaction remains unexercised.
