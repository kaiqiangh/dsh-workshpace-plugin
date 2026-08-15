# Bound previews and binary resources

**Status:** accepted

Every preview request uses a normalized Workspace Path and the host resolver, then rechecks canonical containment immediately before stat/read/open. The browser receives relative logical paths or typed preview data only; binary bytes are addressed by a short-lived Opaque Resource bound to the Harness Session, canonical Workspace Root, path, and current file version. The resource route revalidates identity, type, size, and containment at open time, expires on session/root disposal or file-version change, and never accepts a raw path query.

Preview limits use the PRD defaults and remain operator-tunable through the configuration decision: text 2 MiB, JSON 5 MiB, CSV 10 MiB/1,000 rows, image 20 MiB, and PDF 50 MiB. Hosts stat before reading, parsers are bounded, truncation is explicit, and malformed content returns a local typed error. Code/plain text uses escaped text; Markdown wraps the public primitive with raw HTML disabled and remote images disabled by default. Only HTTP(S)/mailto links are active; relative links are inert in the preview. JSON uses bounded parsing and safe structural limits, CSV is a bounded table, and invalid JSON/CSV falls back to a local error or bounded raw text.

PNG, JPEG, WebP, and GIF use a native image element over an authorized Opaque Resource. SVG is rejected by default until a dedicated sanitizer policy exists. PDF uses a browser viewer over the same bounded resource route and is never treated as a model attachment. Other binary files show metadata and an unsupported state. Missing files, permission errors, stale resources, unsafe content, and unavailable providers stay inside the affected panel and never reveal absolute host paths.
