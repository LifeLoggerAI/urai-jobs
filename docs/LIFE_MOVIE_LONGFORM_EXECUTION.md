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

## Consent propagation

Long-form creation now requires a canonical `life-movie.render` consent context.
The parent bridge checks the existing consent-block authority before creating
children and copies that exact consent context onto every child
`studio.render.video` job. Existing Jobs execution checks therefore reject or
cancel each segment if the consent becomes blocked before or during dispatch.
Parent cancellation also writes explicit `CANCELLED` queue state for every
unfinished segment and clears its active lease token.

## Caption continuity

The segment planner now parses SRT fail-closed, clips cues that cross a child
boundary, rebases them to the child's local timeline, renumbers them, and places
the resulting SRT in each existing short-render payload. Empty caption tracks
remain empty; malformed non-empty SRT is rejected instead of silently dropping
captions.

## Private segmented playback

The hard-off long-form bridge now has an owner/tenant-bound `playback` action.
It only succeeds when every child render is SUCCESS. It validates every child
against the parent segment identity, requires video and SRT objects to remain
under the exact tenant/project/segments prefix, and issues five-minute inline
signed URLs. Raw storage refs are not returned. The playlist preserves each
segment's absolute start/end time and `gapBeforeMs`, plus video/subtitle
checksums and a deterministic playlist digest.

This is private segmented playback, not final single-file export and not public
release authority.
