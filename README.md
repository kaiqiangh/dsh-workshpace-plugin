# DSH Workspace Plugin

DSH Workspace is a session-scoped inspection surface for the files an agent works with. It keeps one canonical Workspace Root per Harness Session and exposes activity, changes, bounded previews, artifacts, a user-controlled Working Set, and governed local Memory without turning the product into a file explorer or IDE.

## Compatibility

Releases are verified against an exact DeepSeek Harness source revision and pinned `0.1.0-rc.6` packages. The supported carrier is the DeepSeek Harness Web host with its supported local operating systems. Remote workspaces, alternate client carriers, and a broader browser/OS matrix are outside this release boundary.

The current compatibility evidence is recorded in [`docs/research/dsh-v05-final-release-evidence.md`](docs/research/dsh-v05-final-release-evidence.md). Domain terms and support boundaries are defined in [`CONTEXT.md`](CONTEXT.md); the architecture decisions live in [`docs/adr/`](docs/adr/).

## Development

```sh
npm install
npm test
npm run check
npm run build
npm run smoke:compat
npm pack --dry-run
```

`npm run smoke:compat` validates the packed consumer against the pinned Harness compatibility baseline. The package exports the host entrypoint (`dsh-workspace-plugin`), web client (`dsh-workspace-plugin/client`), host Typert surface (`dsh-workspace-plugin/typert`), browser Typert client (`dsh-workspace-plugin/client/typert`), and remote client (`dsh-workspace-plugin/remote`).

## Safety boundaries

- Workspace paths are normalized and root-bound; host filesystem paths are not exposed to the browser.
- Preview work is type-, size-, and content-bounded. Binary previews use short-lived opaque resources.
- Session Activity records evidence and attribution separately; observation is not treated as proof of agent causality.
- Working Set continuation sends a scope hint to the owning Harness Session and does not inject file contents.
- Memory writes are session-scoped and governed by validation, provenance, expiry, conflicts, and local-only export rules.

## Release evidence

The release evidence document captures the exact source/package baseline, packed-consumer hashes, browser smoke run, governance/security assertions, and deterministic test, type-check, build, pack, smoke, and diff gates.
