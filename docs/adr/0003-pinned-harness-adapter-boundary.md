# Pin the Harness adapter boundary

**Status:** accepted

DSH Workspace v0.1 is one npm distributable bundle with a Host entry and a Web Client entry, loaded through the public bundle/client metadata and Cordis lifecycle. The release records the exact DeepSeek Harness source revision `47f943859bef60e4160492346772ded9b24f765a` together with the exact resolved package lock; no prerelease range or registry dist-tag is a compatibility promise.

Harness-specific code is isolated behind four Host/Web adapters: activation and disposal, typed Typert Host/Client requests, session observation/event replay, and conversation-node registration. Agent-scoped JSON operations use the generated public Typert Remote surface. Binary previews use a Fiber-owned, namespaced public WebServer route keyed by opaque resource identifiers and revalidate Workspace identity at read time. No adapter modifies the agent loop or imports private registries.

The bundle must fail activation and the compatibility smoke test when required bundle discovery, generated Typert faces, Agent scope, conversation-node registration, or the v0.1 binary resource carrier is unavailable. Optional capabilities such as Git and an individual preview provider degrade locally without taking down the read-only core. Public Markdown, code, and JSON primitives may be wrapped; CSV, image, PDF, and generic resource handling remain Workspace-owned and do not use the attachment store.
