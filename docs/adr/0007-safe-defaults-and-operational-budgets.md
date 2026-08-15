# Use safe defaults and bounded operational budgets

**Status:** accepted

Workspace configuration is discovered host-side from `.dsh/workspace.yaml` under the process Workspace Root. Precedence is built-in safe defaults, then valid file values, then an explicit host-provided override; the browser cannot configure budgets. Invalid YAML or fields produce a local warning and fall back field-by-field, preserving the read-only core.

The PRD defaults are the release defaults: text 2 MiB, JSON 5 MiB, CSV 10 MiB/1,000 rows, image 20 MiB, PDF 50 MiB, timeline 500 events, one-second activity coalescing, and 20 Working Set files. Hard ceilings are text 8 MiB, JSON 16 MiB, CSV 32 MiB/10,000 rows, image 64 MiB, PDF 128 MiB, timeline 5,000 events, and 100 Working Set files. Mandatory safety excludes (`.git`, dependency/build/cache directories) cannot be removed; user excludes append to them and hidden files stay off by default.

Directory listing is lazy with in-flight deduplication and no startup index. Git refresh is one trailing 400 ms debounce with at most one in-flight operation per Workspace. Resource capabilities and timers are Fiber-owned; disposal aborts work, cancels timers, invalidates resources, and removes routes/watchers. Missing Git or an optional renderer degrades locally; absence of the required v0.1 Web resource carrier fails activation as a compatibility mismatch.
