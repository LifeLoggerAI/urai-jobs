# Governed Jobs media and private-source convergence

This component donor combines the exact private-source lineage from #171
`3ba80115674335bc4ea3a10dba04cb9617ee888c`, Captured Reality publisher lineage
from #172 `8c22e4e5c7686d8a511ce746a4ef577c694eec12`, and current Life Movie
owner #170 `6c6ef73426dec7b0456f5f09ecf8b4a93e31873d`. Its primary parent is
the current component owner; both contributing donor heads remain additional
parents. main and the Spatial release authority are untouched.

Only four differing paths overlap between the private-source and publisher
lineages: the consent handler, governed rights executor, package scripts, and
the actual executor's synthetic Captured Reality test. Their reconciliation
preserves the canonical event binding, all private-source authority/recovery
checks, Life Movie revocation, bounded publisher cleanup, and all verify commands.
Other changed paths use the exact selected donor blobs, compared against the
shared ancestor `9b12d226bea7ae870d92abb4cc0099e8f9dc6321`.

Actual combined-executor testing found a further integration defect: bounded
runtime admission cleanup raised `captured_reality_runtime_cleanup_continuation_pending`,
but the private-source continuation policy treated it as a generic failure.
The policy now admits only that exact known bounded message. Unknown Storage
failures remain within the three-failure budget. The governed deletion result
also retains the publisher cleanup acknowledgement for this invocation, without
claiming global, provider, or cross-system erasure.

The new regression executes the real shared handler with synthetic Firestore
and cleanup boundaries. It proves four pending runtime-cleanup deliveries do
not consume the failure budget; every call has a permanent owner fence and
current governed request; owned jobs remain discoverable until cleanup completes;
the same epoch survives; terminal replay performs no extra cleanup; private
EXPORT does not delete runtime assets; and unknown runtime failures stop after
three attempts. The regression fails on the unmodified combined source.

Native exact-head frozen dependency installation, workspace build/typecheck,
full verify, and loaded Firebase Functions emulator evidence remain required.
Local tests do not establish real private source custody, provider readiness,
paid execution, runtime admissions, visual acceptance, device certification,
deployment, independent review, Golden Master or production parity. Previously
issued signed credentials may remain usable until expiration unless the actual
storage layer proves revocation; response fencing does not claim instant
invalidation of already-issued credentials.
