# Jobs Movie, reconstruction and narrator provider boundary

This is a narrow source inspection and isolated narrator correction. It does not authorize provider execution, provision a GPU, change owner branches, activate a deployment, admit private media, or certify a final movie or reconstruction.

## Exact source inspected

| Owner / source | Actual execution path | Provider spending boundary |
| --- | --- | --- |
| Movie #170, `5beab6fae0dd398cfadedbf0334f3a05839d22b7` | `functions/src/jobs/executeJob.ts` → HTTP Studio worker `/` → `workers/studio-worker/index.js` `renderLifeMovie` / `assembleLifeMovie` → local `ffmpeg` / `ffprobe`, private Storage reads and writes | No provider generation POST or delegation to Factory is present in this worker. Both payload parsers require `providerGenerationAuthorized === false`; output receipts retain `providerCalled: false` and `providerSpendAuthorized: false`. Cloud processing/storage costs are separate from provider generation and are not claimed to be zero. |
| Captured Reality #172, `8c22e4e5c7686d8a511ce746a4ef577c694eec12` | `workers/captured-reality-worker/index.js` `/execute-job` → private source `/authorize` → configured private engine `/reconstruct` → `reconstruction-engine.js` resolver `/check` / `/redeem`, local `ns-process-data`, `ns-train splatfacto`, `ns-export gaussian-splat`, private callback | No RunPod purchase/provisioning or other provider generation API POST exists in these inspected leaves. The local CUDA worker requires an already available compute runtime. `CAPTURED_REALITY_COMPUTE_ENABLED` and an opaque `computeAuthorityRef` are configuration, not genuine spending approval or account reservation. This inspection does not close admission of paid GPU compute. |
| Narrator #170, same exact Movie owner source | `functions/src/jobs/executeJob.ts` → authenticated `/execute-job` → `src/handlers/index.ts` `narrator.tts` → `src/handlers/narrator-tts.ts` | Google `TextToSpeechClient.synthesizeSpeech` and ElevenLabs HTTP POST were actual billable leaves. The Functions dispatcher reads protected ElevenLabs consent/rights/voice authorization; those checks do not constitute a spending reservation. The original Google leaf had no canonical spending admission. The tracked legacy JS handler also contained an unprotected Google SDK leaf. |

Verified predecessor Git blobs: narrator TS `3725796654330e9ffddd559cb28d3d93d160330e`, narrator JS `8b168c5facafd9a4c52ee8309d976d9349dc72bc`, Movie worker `c8ee3debff2e6c641ac92c9a6df22379cfb66570`, Captured Reality worker `ddec96731f333e11ba740f7878fb1a0a7da75fa4`, reconstruction engine `f3f2d00cd8d6597a59dd484f3ddf9f2e0ab9ddec`. No `AGENTS.md` exists in either inspected owner tree.

Before publication, fresh owner metadata showed Movie delivery #173 admitted into #170: the current Movie owner head is `6c6ef73426dec7b0456f5f09ecf8b4a93e31873d`. Its tree retains the exact narrator and Movie worker blobs listed above. This donor is based on that refreshed owner head and preserves the admitted delivery correction.

The legacy `workers/narrator-worker/index.js` is a lease-checking placeholder with no provider request. The deployment Dockerfile compiles TypeScript and starts `dist/index.js`. Both the actual TS paid handler and its tracked JS alternative are fenced by this donor; JS parity is executable regression coverage.

`scripts/runpod-gaussian-preflight.mjs` checks local policy/environment values and performs no provider HTTP request. Its printed `ok` is not a canonical approval, account reservation, protected runtime proof, or permission to launch a GPU.

## Isolated narrator behavior

Both actual paid POSTs now require the existing canonical Factory `/api/worker/production-spend` **v2 cross-repository contract**. An authenticated, non-authorizing `preflight` must return an exact protected job and a fresh request-specific `protected_pricing` proof; `reserve` must authenticate the genuine signed approval, current independent deployment/control proofs and shared account transaction before one POST can occur. `record` reports an outcome only. It cannot settle a charge, release a hold, or authorize retry. A lost reserve response sends no provider request; a lost provider response keeps the reservation unresolved; successful output requires a durable observation. Charges remain held for the separate independently authenticated reconciler.

No approval, pricing record, protected account, controls, deployment proof, signer key or worker registration is created by the worker or this donor. The client never substitutes a Jobs SHA for the actual Factory gateway SHA.

Before reservation, the returned protected pricing must bind the actual provider/account/model/request and all four credential/header/source-input/content-type fingerprints, have a nonempty receipt and trusted readback, and carry fresh observed/expiry times and rates equal to the signed job budget. Missing, stale, invalid-calendar, future, untrusted or mismatched pricing blocks the actual paid leaf.

All v2 request fields are sent on preflight/reserve/record: `job_id`, `worker_id`, `executor_repository`, `executor_source_sha`, `gateway_repository`, `gateway_source_sha`, `consumer`, `tenant_sha256`, `provider`, `account_id`, `credential_sha256`, `source_input_sha256`, `semantic_headers_sha256`, `content_type`, `request_sha256`, `endpoint`, `model`, `asset`, `request_size`.

| Required protected configuration | Binding / purpose |
| --- | --- |
| `ASSET_FORGE_SPEND_GATEWAY_URL` | Canonical public HTTPS URL ending exactly `/api/worker/production-spend`, no query, credentials or redirect. |
| `ASSET_FORGE_SPEND_GATEWAY_ORIGIN` | Protected issuer origin; it must equal the issuer-mapped gateway URL origin before transmitting any worker credential and remain fixed through awaited work. |
| `ASSET_FORGE_SPEND_GATEWAY_SOURCE_SHA` | Exact separate Factory gateway revision; it must match the signed v2 job and the gateway's actual enforcement source. |
| `URAI_SOURCE_SHA` | Actual clean Jobs checkout head, with all four protected TS/JS source files tracked and unchanged. A declared environment SHA alone is rejected. |
| `URAI_NARRATOR_SPEND_BINDINGS_JSON` | Server configuration maps an exact wire request digest to an existing protected `job_id`, `worker_id`, `account_id` and distinct scoped `token`. No caller job body field chooses these authorities. The canonical registry fixes executor repository/SHA, consumer `jobs-narrator`, tenant digest, provider, API account and exact credential digest. |
| Genuine v2 protected records | Authenticated approval, source authority, verified request-specific pricing, shared API account/balance reservation and fresh independently signed deployed control/source proofs. Missing records keep execution blocked. |

The source input digest covers the actual dispatched job, including owner, tenant, queue lease, payload, consent and ElevenLabs provenance/rights/voice authority. It is rechecked after awaited gateway work. The wire digest is SHA256 of UTF-8 `POST\n<canonical URL>\n` followed by the exact frozen body bytes; request size is the decimal UTF-8 byte count. Lower-case effective credential headers (`authorization`, `xi-api-key`, `x-api-key`) and all remaining semantic headers have separate stable sorted JSON hashes. Redirects, SDK automatic retries, duplicate paid submissions, input/configuration changes and uncertain gateway results fail closed. The approved lifetime is at most 45 seconds and spans response decoding and output persistence.

Google uses explicit authenticated REST `POST https://texttospeech.googleapis.com/v1/text:synthesize`, retaining `input.text`, configured/default `voice.languageCode`, configured `voice.name` / voiceId and MP3 / OGG_OPUS behavior. The actual ADC client supplies the OAuth access token, service principal, expiry and effective quota project. The explicit quota header and exact token are frozen and rechecked before reservation and after reservation. Its protected `account_id` must equal `google:<actual quota project>:<actual ADC principal>`. A missing principal, missing/expired token, unknown quota or token expiring inside the approved lifetime blocks execution. Rotated credentials require fresh genuine protected records; local labels cannot change the actual billing identity. The worker decodes the documented REST base64 `audioContent`, with no SDK synthesis fallback.

Official primary contracts verified for this conversion: [REST text.synthesize](https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize), [Google REST TTS quickstart](https://cloud.google.com/text-to-speech/docs/create-audio-text-command-line), [quota project precedence and header](https://cloud.google.com/docs/quotas/set-quota-project), [Google authentication library](https://github.com/googleapis/google-auth-library-nodejs).

Existing ElevenLabs enabled/key/voice allowlist/text/model/output format and canonical dispatcher consent/rights/provenance checks remain required. Credential rotation, model/format drift and allowlist revocation during gateway awaits block the provider POST. No provider error body or credential is retained in the worker error message.

## Verification and remaining admission

The original exact TS handler reproduces Google and ElevenLabs paid dispatch without any canonical spending event using synthetic transports. The corrected TS and tracked JS execute 120 actual-leaf regression groups: both providers, no authority/caller forgery, gateway failures, exact scopes/body/header/input/source drift, credential/account/quota expiry, denied or uncertain reserves, duplicate attempts, response loss, deadline abort, invalid audio, Storage failure, durable observation failure and exact JS compilation parity. Frozen real Google TTS 5.8.1 / Storage 7.18.0 / TypeScript 5.9.3 declarations pass strict focused compilation on Node 24.19.0. The inherited ElevenLabs source/consent/deployment contract is retained and now runs the actual-leaf suite through existing `urai-jobs:verify`.

These fixtures execute the real worker leaves with synthetic ADC, Storage and gateway transports. They prove client ordering, request binding, denial and uncertainty behavior; they do not manufacture or prove genuine protected production approval/account/deployment records. The canonical gateway owner separately validates Ed25519 signers, shared account transactions and genuine controls. Fresh exact-head native complete-workspace validation and paired gateway v2 admission remain required; predecessor workflow results never transfer.

The predecessor narrator Docker image contained neither Git nor a clean checkout. The current candidate prepares a clean exact sparse Git source context outside the checkout, preserves the frozen workspace graph, removes local Git remote/reflog metadata and timestamp-bearing index data, reconstructs the exact index inside Docker, and builds the narrator without rewriting its package or deleting the shared-types dependency. Actual runtime source checks remain unchanged. Native CI must build this container and execute its compiled source guard with networking disabled. Genuine v2 deployment/control/account/approval records and paired canonical gateway authority remain required before paid execution; prepared source does not authorize deployment or spending.

Movie runtime still requires authentic current queue/consent/scene-truth authority, private source bytes, Storage credentials, exact source/revision and actual FFmpeg runtime; final literal/identity/media/art/visual acceptance is separate. Reconstruction still requires genuine private sources/handles, resolver and engine/callback credentials, current job/lease/consent authority, pinned Spatial/component envelope, CUDA/Nerfstudio, durable private storage and protected runtime recovery; paid compute admission and genuine account/budget authority remain separate. Factory direct video/image/model/audio leaves belong to their existing Factory owner and were not changed here.

Main, Movie #170, private-rights #171, Captured Reality #172 and Movie delivery #173 remain untouched. No provider call, billing, real private media transfer, CUDA execution, merge, deployment or independent human release approval is established. Canonical coordination remains Labs #61.


## Absolute expiry and native compatibility successor

This isolated successor preserves Jobs #175 exact `d87c13741d6e00758cc537d9d7f1f9df15254952` and consumes canonical Factory #445 exact `acea7eaf1ccec8ce34bff99ebb8eb527a7b67098`, parent #443 `047c8429626300c9896bc8c4b739b5902575ad38`. Do not admit #175 as a completed native build: its 120 actual-leaf synthetic regressions passed, but the aggregate workers configuration rejected `Headers.entries` under explicit `lib:[ES2022,DOM]`. This successor normalizes the same effective header pairs using standard `Headers.forEach` with the same sorted hashes. It adds no declaration shim or library change.

Every issuer-protected narrator mapping entry must include `gateway_url`. The configured canonical HTTPS gateway URL must match that exact issuer pin before a worker secret is sent. An environment-only replacement cannot become the authority destination. Preflight must provide verified absolute `admission_expires_at`; reserve must provide `reserved_at` plus `admission_expires_at`, bounded by preflight expiry and reserved time plus approved runtime. The client establishes its own runtime deadline before awaiting reserve and takes the minimum of all verified bounds, so response latency cannot restart the clock. Missing, expired, future or extended times keep execution blocked and canonical account holds retained. Exact source/input/provider credential/config checks and expiry run before POST and after provider, output and record awaits. No successful response is delivered after expiry.

The new synthetic cases execute actual TypeScript and tracked JavaScript leaves for both Google and ElevenLabs, including issuer URL substitution, missing/expired/extended times, delayed reservation, post-provider/persistence/record expiry and source drift during observation. Tracked JavaScript is parsed and compared structurally against the actual TypeScript compiler output, proving equal syntax trees while allowing formatting differences during connector-only reconstruction. Native exact-head typecheck, compiler parity and runtime contracts must validate the final successor; older local/native counts do not transfer to these new bytes. No provider request, deployment, new protected approval/account record, charge reconciliation, merge or runtime acceptance is performed.

## Combined Jobs component source

The component convergence now retains the private-media/offline-world source from #176, narrator source from #175/#178, the stronger #177 issuer-origin/pricing checks, and the exact #174 canon provenance document. Both issuer mapping `gateway_url` and `ASSET_FORGE_SPEND_GATEWAY_ORIGIN` must agree. Runtime ends at the earliest verified preflight, request pricing, signed rate, local pre-reservation runtime or server reservation expiry. Server reservation time must lie within the current local reservation interval, with a positive admission interval. Source, credential, issuer mapping and input are rechecked after credential awaits and through provider, Storage and observation awaits. No donor workflow result is transferred to the combined tree.

The combined actual-leaf synthetic suite passes 208 TS/JS behavior and compiler-parity groups on Node 24.19.0 with zero provider network requests. Complete-workspace typecheck passes with the frozen pnpm 8.15.9 graph. Six actual Git build-context groups prove the unchanged paid-leaf source guard, byte-identical repeated exports, dirty/mismatched/symlink denial, destination preservation and protected Docker wiring. Native exact-head Jobs CI, compiled container proof, emulator, deployment controls and paired Factory source admission remain separate gates. Genuine deployed source/control/account/approval readback remains required.

## Source/artifact attestation successor

The canonical sparse Git builder and frozen dependency path are retained. The
current source/package implementation in `NARRATOR_RUNTIME_SOURCE_PACKAGE.md`
adds exact Git object membership, complete source coverage, pinned base image,
and a compiler-emitted artifact seal. Production/staging source checks require
both genuine source and sealed output integrity; `/readyz` reflects that check.
The local27package/6builder/232actual paid-leaf tests are synthetic machine evidence,
not an independently signed image or genuine provider/account readiness proof.
No Docker engine/image readback is available here. Native exact-head image/runtime
verification, deployment/control signatures and protected approvals remain required;
paid execution is closed until these separate gates legitimately pass.
