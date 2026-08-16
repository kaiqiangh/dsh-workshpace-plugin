# v0.5 Memory Governance implementation evidence

Fixed SHA: `af1503b1e1d97fd1613ab8f4787d69c65ec0b222`

- Governance records carry origin, source references, verification/stale state, revision, retention, optional conflict/expiry/pin metadata, and typed transitions.
- Verify/reject/reverify, stale, pin/unpin, archive/restore, and forget require explicit user authorization where destructive or trust-elevating.
- Host governance uses revision plus content hash optimistic checks under the append lock; export/import remaps IDs, preserves and rechecks provenance hashes, bounds imports, and quarantines imports as unverified with unretractable-copy disclosure in the Web surface.
- Expired verified records remain visible as stale repair candidates; the review surface exposes governance metadata, side-by-side conflict comparison with choose/reject controls, server-enforced Shared Project write acknowledgement, and alert-dialog focus return.
- Memory inspection stays review-only: search, render, pin-for-review, export, and import never call Agent/followup/model seams.

Evidence: governance, conflict, import/export, scope, and no-injection tests are included in the 111-test suite; check/build/pack/compatibility smoke are green. Browser governance dialogs remain environment-blocked by the same missing API key/session/workspace limitation recorded for v0.3/v0.4.
