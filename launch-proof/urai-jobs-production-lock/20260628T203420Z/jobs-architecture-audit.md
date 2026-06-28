# URAI Jobs architecture audit

## Verdict
URAI Jobs is now hardened for local lifecycle proof, but it is not production worker ready until explicitly deployed and production-smoked.

## Implemented architecture
- Callable job creation writes job and queue records.
- Job creation validates an allowlisted job type and payload schema.
- Job creation enforces idempotency through a dedicated idempotency record.
- Dispatcher starts work only from LEASED state.
- Dispatcher validates matching lease token on job and queue state.
- Dispatcher no-ops duplicate terminal deliveries.
- Inline fallback is disabled by default and production dispatch fails closed when required worker config is missing.
- Logs are persisted for creation, dispatch, success, failure, and no-op events.
- Admin route is gated through AuthGate with operator-claim enforcement.
- Create route is gated and wired to a locked narrator.tts surface.

## Not production-proven
- No live production lifecycle smoke was run in this pass.
- No deployment was performed.
- Real production worker execution still requires operator-approved deploy plus production smoke proof.
