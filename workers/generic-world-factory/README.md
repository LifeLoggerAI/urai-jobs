# UrAi Generic World Factory — offline queue and quarantine

This isolated worker subtree prepares real, hash-bound modular production jobs for the existing Generic World Library Studio #153 / Jobs #152 lanes. It does not change deployed workers, the active Spatial candidate, Asset Factory resolution, or provider adapters. It uses Node's built-in libraries and requires no install.

## Prepare and validate all available world families

From the Jobs repository root:

```bash
node workers/generic-world-factory/cli.mjs prepare \
  --specs ../world-factory-studio/productions/generic-world-library/v1/specs \
  --out workers/generic-world-factory/prepared \
  --authority /absolute/path/to/current-authority.json

node workers/generic-world-factory/cli.mjs verify --package /absolute/path/to/gwq-<sha256>
node --test workers/generic-world-factory/test/*.test.mjs
```

`prepare` discovers all Batch 1 and Batch 2 spec JSONs in the supplied directory. A scene must be `GENERIC` and `SPECIFIED`, have a deterministic ID and semver, and expose `modularKit` entries with role, description, metric dimensions, material intent, source, rights, GLB output, and existing Model Forge adapter IDs. The exact world-spec bytes and authority bytes are copied into the immutable package.

The default primary adapter is `meshy`; `--provider tripo`, `rodin`, or `replicate` selects an already nominated alternative. Those IDs are the existing `model_forge/forge.mjs` IDs. Each job is one modular kit, one candidate, and at most one provider attempt. Shared IDs deduplicate only if their kit specifications are byte-canonical identical. A conflicting kit must receive a versioned successor ID.

The input set SHA-256 determines the directory `gwq-<64-character-sha256>`. It also binds the exact preparation code files, copied into the package, so implementation changes create a successor even if world inputs remain unchanged. Repeating preparation with unchanged inputs returns the original package and receipt. Changes create a separate package. The content manifest and checksum inventory bind specifications, exact provider prompts, provider specs, job payloads, lifecycle definitions, provenance templates, authority, and receipts. Each output provenance template carries the exact job and input hashes while actual output hash, date and submission ID remain null. An unfilled template cannot be imported as output. Verification rejects altered files, missing dependencies, extra unreceipted files, source-binding drift, and unsupported truth/spend/status claims.

## Authority input

Provide an evidence-derived JSON file. Exact heads are provenance of the observed parallel lane, not approval of the active release candidate:

```json
{
  "schemaVersion": "urai-generic-world-factory-authority-v1",
  "observedAt": "2026-10-07T00:00:00Z",
  "repositories": {
    "studio": {"repository": "LifeLoggerAI/urai-studio", "head": "<exact current 40-character SHA>", "issue": 153},
    "jobs": {"repository": "LifeLoggerAI/urai-jobs", "head": "<exact current 40-character SHA>", "issue": 152},
    "assetFactory": {"repository": "LifeLoggerAI/asset-factory", "head": "<exact current 40-character SHA>"}
  },
  "spendAuthorized": false,
  "integrationAuthorized": false
}
```

The template is not a receipt. Supply actual refreshed GitHub evidence. The validator intentionally rejects placeholder SHAs and authority asserting spend or integration.

## Paid and runtime boundary

No command here makes a network call, reads a credential, dispatches a GitHub workflow, invokes a provider, or purchases anything. There is no `execute`, `submit`, `promote`, or spend option. Setting `URAI_MODEL_FORGE_SPEND_AUTHORIZED=1` has no effect on this CLI.

`READY_FOR_PROVIDER` means an offline job packet passed specification validation. Paid execution still requires current explicit bounded spend authority, a current cost quote, and credentials through the existing Asset Factory boundary. Resource records show `UNKNOWN` credits/compute, zero spent, no provider submission ID, and the exact one-attempt bound. No price is guessed.

The packet's proposed `asset.generate` operation is an existing legacy Asset worker operation. It is **not a currently admitted live runtime job**: the deployed worker dispatch does not carry this per-kit spec. These files must not be submitted to its generic forge event. Actual future manufacture should use the existing governed Model Forge entrypoint after admission/spend review. No competing resolver or new job type is added.

With no governed reference images, packets are text exploration candidates. They cannot confer final-art authority. Manufacturer execution must refresh authority and select governed references if final production art is intended.

## Quarantine actual provider output

```bash
node workers/generic-world-factory/cli.mjs quarantine \
  --package /absolute/path/to/gwq-<sha256> \
  --job gwjob-<sha256> \
  --glb /absolute/path/to/actual-candidate.glb \
  --provenance /absolute/path/to/actual-provenance.json \
  --out /absolute/path/to/quarantine \
  --model-forge-root /absolute/path/to/existing-asset-factory/model_forge
```

Provider-output provenance requires `schemaVersion: urai-generic-world-output-provenance-v1`, exact `jobId`, `sourceKitSha256`, `providerSpecSha256`, nominated `provider`, real `providerSubmissionId`, creator, generation date, `truthClassification: GENERIC`, actual `outputSha256`, and a license record with `status` (`CLEAR`, `UNKNOWN`, or `RESTRICTED`), `commercialUse`, and `identifier` where clear. Never invent a submission ID or license.

The importer verifies exact package/source/output bindings, GLB binary chunk and accessor bounds, finite POSITION values, indices, embedded images, material references, primitive counts, and the prepared triangle limit. It then invokes the existing local `model_forge/validate-glb.mjs` without a shell or provider call. No imported asset is automatically promoted. Each import is copied into a new content-addressed `gwcandidate-<sha256>` quarantine directory with provenance, validation, checksums, and a receipt; the prepared package remains unchanged.

Unknown or restricted commercial rights produce `BLOCKED`. Clear rights still produce only `GENERATED`. This structural import does not grant full asset `MACHINE_VALIDATED`: actual scale/orientation, UVs/normals, collision/nav, LOD switching, texture memory, representative previews, desktop/mobile/XR performance, literal visual review, and governance acceptance remain separately required. Required extensions and external image dependencies fail closed until a separately governed validator supports them. Structural checks are not full glTF Validator certification.

`ACCEPTED` is a later explicit Asset Factory decision. Runtime integration, release acceptance, independent reviewer approval, and XR physical-device certification remain separate decisions and evidence.

## Verification evidence

The test suite exercises real disk writes and real rejected inputs: nested autobiographical truth, recorded/reconstructed truth laundering, real-person likeness flags, spend flags, fabricated acceptance, shared-kit conflicts, hash corruption, unreceipted files, malformed GLBs, out-of-range indices, external textures, and provenance mismatch. Successful quarantine tests use disposable fixtures explicitly marked `TEST_FIXTURE_NOT_REAL_PROVIDER_EVIDENCE`; no test fixture is retained as production content.

The same command validates any subsequent Batch 2 specifications. Batch size does not imply generated worlds: receipts explicitly distinguish specified worlds, unique kit jobs, actual generated assets (zero in preparation), previews (zero), and provider calls (zero).
