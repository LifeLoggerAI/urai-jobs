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

Current truth before runtime enablement:
- consent context is propagated to every child, and parent-level revocation is surfaced fail-closed;
- private segmented playback is implemented with owner/tenant/bucket/path checks and short-lived authenticated byte access;
- subtitle segmentation, boundary clipping, rebasing, and final merge are implemented fail-closed;
- final assembly is implemented as a distinct `studio.assemble.video` queue job with checksum verification, gap preservation, caption merge, bounded output authority, cleanup, resume, cancellation, and deletion semantics;
- source-level restart/resume/recovery contracts are implemented, but deployed Firestore/worker restart evidence is still required before enabling the runtime;
- literal long-form audio/video acceptance on the frozen deployed worker remains required before production enablement.

`URAI_LIFE_MOVIE_LONGFORM_ENABLED` remains hard-off by default until the remaining deployed-runtime and literal media acceptance evidence exists.

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
nonbearer delivery descriptors. Raw storage refs are not returned. The playlist preserves each
segment's absolute start/end time and `gapBeforeMs`, plus video/subtitle
checksums and a deterministic playlist digest.

This is private segmented playback, not final single-file export and not public
release authority.

## Private output byte authority

Short and long-form Life Movie access now both require the output bucket to be
explicitly configured by `GCS_BUCKET_NAME` or `URAI_STUDIO_OUTPUT_BUCKETS`
and require every object to remain under the bound tenant Life Movies prefix.
The same bucket/path authority applies before generated-output deletion. A
worker result cannot make the Functions identity sign or delete an arbitrary
accessible bucket merely by returning a crafted `gs://` reference.


## Final assembly and lifecycle convergence

Final assembly is a distinct `studio.assemble.video` queue job. It does not increase the bounded child renderer's 15-second envelope. The assembly job verifies every child MP4/SRT SHA-256 before use, preserves timeline gaps, shifts subtitle timing into the parent timeline, writes a private final MP4/SRT/manifest under the tenant/project final prefix, records exact final hashes, and deletes partial uploads on failed attempts.

The worker accepts the bridge's canonical `final/` output root after trailing-slash normalization and rejects sibling prefixes. Assembly additionally enforces the 15-second child and 45-minute parent ceilings before downloading. A matching SHA-256 is necessary but insufficient: FFprobe must establish exactly one H.264 yuv420p video track at the declared dimensions/FPS with square pixels and one AAC-LC 48 kHz stereo audio track. Child codec configuration hashes, profile and time bases must agree, including generated gap clips. Each bounded child fully decodes with fatal-error handling before admission. Child duration/frame counts and the final assembled duration/frame count are checked with bounded frame/AAC packet rounding tolerance. Declared concat durations and preserved timestamps prevent child container rounding/AAC priming offsets from accumulating across the parent timeline. Captions with malformed timestamps or bounds outside their child are rejected. Assembly receipts retain these media measurements and explicitly keep literal media, identity and production acceptance false.

`scripts/life-movies-assembly-media-smoke.mjs` executes four actual 15-second motion/audio child renders and a 61-second assembly with leading/inter-segment gaps and shifted captions. It verifies output hashes and fully decodes the MP4, then exercises hash-correct malformed media, incompatible codec configuration, subtitle bounds, timeline ceilings, cancellation, consent revocation and partial-upload cleanup. Firestore/GCS are in-memory adapters with synthetic sources. This is executable source/media evidence, not deployed private playback, a final family film, a provider result, CUDA reconstruction, literal identity/quality acceptance or device acceptance. Native Runtime CI retains a SHA-bound synthetic diagnostic and receipt.

The long-form bridge also provides explicit resume for terminal failed children/assembly, immediate parent-level consent-revocation visibility, fail-closed playback/resume after revocation, and owner-bound generated-output deletion that retains source evidence.

Playback and attachment export now read coherent transactional authority before Storage work and again after signing/subtitle awaits, before releasing any URL or private captions. The response remains bound to the same owner, tenant, project, consent receipt, source payload, exact outputs and parent/child timeline. Permanent deletion/revocation fences reject delivery even if a stale success status remains. Every long-form child and final assembly is checked against its owner/project/parent binding and all artifact locations before the first signature. Slow signing cannot return already expired five-minute credentials. A changed authority returns an error without the prepared media response.

`scripts/life-movies-delivery-authority-smoke.mjs` runs 38 actual HTTP-handler cases against synthetic transactional Firestore and Storage, covering owner deletion during signing, consent revocation during signing and subtitle downloads, source correction/output changes, permanent fences, foreign project/parent/owner bindings, ordinary private playback/export and expired credentials. The retained #170 predecessor source blobs reproduce 31 stale or foreign deliveries in the same fixtures. The new regression is part of `urai-jobs:verify`. This proves source behavior, not deployed Firestore concurrency, private playback, native device acceptance, or a final family movie. Signed URLs delivered before a later revocation still require object erasure or expiry; this bridge check does not certify immediate invalidation of previously delivered URLs.

Private delivery now uses the existing authenticated bridge `deliver` action.
Every admitted chunk rechecks the full parent/child consent, owner/deletion,
source and output fingerprint. Immutable GCS generations are pinned. The
controller retains its original 60-second timeout and each byte request has a
55-second cleanup deadline within the descriptor expiry. Already delivered
bytes cannot be recalled. No signed Storage URL is issued.
