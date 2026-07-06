# URAI Release Version Contract

Status date: 2026-07-06

## Authority

The canonical asset-version contract is owned by:

- Repository: `LifeLoggerAI/asset-factory`
- Path: `image_asset_generator/canonical_version_catalog.json`
- Schema version: `1.0.0`
- Target runtime repository: `LifeLoggerAI/urai-spatial`

`urai-jobs` consumes this contract for release planning. It must not redefine version meanings independently.

## Canonical matrix

| Version | Meaning | Expected outputs | Prefix | Device proof |
|---|---|---:|---|---|
| V1 | Genesis Public Route World | 53 | `assets/urai` | Equivalent/waiver when applicable |
| V2 | Living System States | 80 | `assets/urai/v2` | Equivalent/waiver when applicable |
| V3 | Relationship, Shadow and Pattern World | 14 | `assets/urai/v3` | Equivalent/waiver when applicable |
| V4 | WebXR, AR and VR Pathway | 39 | `assets/urai/xr` | Quest/controller-or-hand/comfort/performance receipts required |
| V5 | Mirror of Becoming and Autonomous Legacy | 27 | `assets/urai/v5` | Equivalent/waiver when applicable |

## Safety rules

- Release planning remains `plan-only`, `dryRun=true`, `noSideEffects=true`, and `readyForExecution=false`.
- A fallback artifact cannot certify production.
- Web CI cannot be used as Quest/device proof.
- Promotion requires human approval, rollback planning, and a promotion receipt.
- Paid provider forging requires explicit payment authority and the Asset Factory cost-control gates.
- V3 must never be described or processed as the 39-output XR release.
- V4 must never be described or processed as an autonomous-council release in the current canonical contract.

## Synchronization

When the canonical Asset Factory catalog changes, update the typed contract and runtime assertions in the same pull request. The release verifier must fail if labels, counts, prefixes, target repository, or device-evidence mapping diverge.
