# Send Working Set as a follow-up

**Status:** accepted

Working Set is an ordered, duplicate-free list of normalized Workspace Paths, scoped to the Workspace identity and resumed with it. The default maximum is the PRD value of 20 and remains configurable under the operational-budget decision. Deleted or renamed selections stay pinned and visibly unresolved until the user unpins or clears them; Send includes the logical paths with an unresolved marker rather than silently dropping scope.

Send to Agent is one explicit Continuation Action implemented with one freshly resolved Agent and one `followup()` UserMessage. It is a separate next-turn instruction, so it does not interrupt the current model/tool step; while idle it starts a turn. The message contains only deterministic path lines and an instruction to inspect them as needed. It never embeds file contents, absolute paths, or hidden context. A stale/missing Agent or enqueue error returns a local delivery failure without mutating the Working Set or automatically retrying; the user may invoke Send again.
