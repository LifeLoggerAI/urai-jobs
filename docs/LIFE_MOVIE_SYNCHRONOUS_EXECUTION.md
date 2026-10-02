# Life Movie synchronous execution boundary

The current Studio worker is a bounded short-render executor. A 45-minute
authoring plan is not an admitted synchronous render. Long-form execution needs
a separately verified durable/chunked design and remains unavailable here.

Jobs admission and worker parsing enforce the same budget:

| Dimension | Limit |
| --- | --- |
| Output duration, including gaps | 30,000 ms |
| Pixel frames (width × height × fps × duration seconds) | 933,120,000 |
| Pixels per frame | 8,294,400 |
| Sources / timeline items | 12 / 12 |
| Downloaded bytes per source / total | 32 MiB / 64 MiB |
| Worker deadline | 110 seconds; configurable only downward |
| Studio worker HTTP request | 120 seconds |
| Pub/Sub dispatcher | 180 seconds, including transport and bookkeeping |

The pixel budget admits 15 seconds at 1920×1080 and 30 fps, 3.75 seconds at
3840×2160 and 30 fps, or up to 30 seconds at a smaller resolution. It counts
leading/inter-clip gaps. Oversized requests fail before queue admission; direct
worker requests are also rejected. Studio must enforce this render boundary
before dispatch while retaining its separate authoring limits and hard-off gate.

Each segment uses one H.264 encoder thread. All segments share the same output
profile and are concatenated by remuxing, avoiding a redundant whole-movie
encode. Durable lease, tenant/payload binding, consent revocation, cancellation,
deadline cancellation, private uploads and attempt-isolated cleanup remain in
force. Neither the render deadline nor its cancellation assertions were relaxed.

## Reproducible verification

Run `node scripts/life-movies-dimensions-smoke.mjs` for admission/worker boundary
parity and rejection of long plans, gaps, oversized frames and source/item counts.
Run `node scripts/life-movies-media-timing-smoke.mjs` and
`node scripts/life-movies-cancellation-smoke.mjs` for actual FFmpeg timing,
cancellation, revocation, cleanup and idempotent attempt isolation.

Run `node scripts/life-movies-render-budget-smoke.mjs` for two concurrent actual
15-second 1080p30 renders, three clips per render, private local storage fixtures,
codec/duration inspection and the unchanged 110-second deadline. This proof also
runs in the existing runtime CI lane. To reproduce the one-CPU constraint on
Linux, select a CPU from `os.sched_getaffinity(0)` and invoke the script using
`taskset -c CPU node scripts/life-movies-render-budget-smoke.mjs`.

The local one-CPU, concurrency-two experiment completed both repaired renders in
73.732 seconds; each MP4 measured 15.021333 seconds. The predecessor's equivalent
double-encode experiment took 127.922 seconds. These synthetic measurements are
local evidence, not Cloud Run performance certification or proof for arbitrary
media. Network delays, corrupt/complex input and unavailable consent authority
still fail within the bound. No provider was called and no cloud resource was
provisioned. Keep rendering hard-off pending independent review and existing
protected activation requirements.

## Integration and recovery

Review this repair against its exact Jobs #105 parent, and the matching Studio
child against #119. Do not transfer parent approvals. After authorized integration,
rebuild the full resulting Jobs/Studio heads and repeat the runtime and rules
matrix. The canonical production workflow is preparation only: it requires its
existing main/ref guard, protected environment, WIF identity, source and artifact
proof, approval, rollback configuration fingerprints and live verification.
None was invoked for this repair. A rollback must not restore oversized render
admission while an incompatible worker is active; keep the existing render
hard-off gate closed until a compatible reviewed pair is verified.
