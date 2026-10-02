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

## Durable parent orchestration

The next source slice is now implemented behind
`URAI_LIFE_MOVIE_LONGFORM_ENABLED=false`.

`studioLifeMovieLongformBridge` verifies the SceneTruth receipt exactly once at
the parent boundary. That preserves the existing single-use replay defense:
child short renders are created internally and never replay the same receipt
through the public short-render bridge.

One Firestore transaction creates the private parent plan and every bounded child
job/queue entry. The 180-segment ceiling keeps this below Firestore's 500-write
transaction limit while preserving the 15-second child-render boundary.
Idempotent retries return the same parent plan. Status is derived from sanitized
child states only; no raw storage refs are exposed. Cancel marks every unfinished
child CANCELLED, clears active lease authority, marks its queue entry DONE, and
cancels the parent.

Still intentionally open before runtime enablement:
- consent-revocation fan-out beyond the existing child worker authority;
- durable aggregate playlist/final assembly;
- subtitle segmentation/merging;
- long-form private playback;
- restart/recovery proof against deployed Firestore/worker infrastructure;
- literal long-form audio/video acceptance.
