# Life Movie durable long-form segmentation — source contract

This source lane is the first executable slice of Jobs issue #129. It does not
turn the existing short synchronous worker into a long-running worker.

`studio.render.video` remains unchanged and fail-closed at its proven bounded
execution budget. The long-form contract accepts a private authoring plan of up
to 45 minutes and deterministically plans short child render payloads that are
individually validated by the existing `StudioLifeMovieRenderPayloadSchema`.

Current segment rules:

- 15 seconds maximum per pre-cut visual source clip;
- at most 180 child segments;
- 1080p maximum in this first long-form lane;
- child source/timeline/audio counts must remain inside the existing
  12/12/12 synchronous worker limits;
- SceneTruth identity/digest and parent render-plan authority carry into every
  child;
- every child receives a SHA-256 identity derived from parent digest, index and
  exact global time range;
- child output stays under the same private tenant/project prefix;
- audio crossing a segment boundary is split and source offset is advanced so
  timing remains continuous;
- provider generation and public release remain hard-off.

The planner intentionally does not expose a runtime job yet. The next bounded
slice must add a durable parent/child orchestrator with idempotent creation,
progress/resume, cancellation/revocation propagation and aggregate private
playback. No existing timeout or short-render acceptance threshold is relaxed.
