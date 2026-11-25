# World001 — Source-disjoint calibrated recapture protocol (research / NO-GO)

**Purpose:** Replace unreliable feature-track identity and insufficient repeatability found in the source-pinned 44 training frames. This is an acquisition specification, not permission to capture someone else's environment, process private family media, use paid cloud resources, or ship a splat.

## Known technical evidence (October 17, 2026)

- Existing source: 7 training surveys, 44 SHA-verified frames, 10,218 provisional landmarks, **314/800 strict landmark criterion** (unchanged).
- Source-derived SIFT matching trial: **194 train/training frame pairs**, 7,226 strong reciprocal matches; 6,265 agree with the registered-pose epipolar geometry under a research 2.5 px Sampson screen.
- Of the pose-consistent matches, **327 pairwise links connect different existing 3D track IDs**. A globally unique-feature owner graph rejects **352** conflicting component merges. No entirely unowned >=4-view component survived the conservative track construction.
- **Camera calibration is approximate**, original frozen S08 heldout already failed and is not an admissible independent test for a new model; no accepted splat exists.

## Capture and authority

1. Capture only an owner-approved **interpretive/non-autobiographical test world** with explicit site and subject consent, and maintain private, locally controlled storage. Do not include family sources or identifying imagery without distinct prior authorization.
2. Use one fixed physical camera/lens, *one* focal length, resolution, sensor crop, and focus setting for the entire calibrated session. Disable electronic image stabilization, lens switching and digital zoom; record mechanical stabilization, rolling-shutter settings and firmware. Lock white balance, exposure, and focus; avoid strong moving shadows, glare, motion blur and featureless reflective surfaces.
3. Calibrate the actual lens/camera with a checkerboard or AprilTag board at the exact capture resolution and focus. Save fx, fy, cx, cy, radial/tangential distortion and calibration residuals. Validate the calibration on separate target images, not on the S08 survey. Flag calibration RMS above ~1 pixel for manual recapture/recalibration; this is a diagnostic target, **not** a replacement for any frozen UrAi acceptance threshold.
4. Walk the seven original directional survey types S01–S07 with steady translational baselines (not pure rotations), multiple heights and overlapping oblique views. Aim for >=75% adjacent-frame coverage overlap and multiple genuinely distinct parallax baselines relative to scene depth. Photograph each persistent textured surface in >=4 separated **training** views, including at least two beyond the seed pair. Target more than 800 potential distinct, well-textured 4-view points with margin for rejection. Avoid repeated structures that are indistinguishable by descriptor alone; introduce removable calibrated reference markers if permitted.
5. Check capture quality *before freezing*: image sharpness, usable dynamic range, lens consistency, sufficient parallax, high mutual SIFT/RANSAC inlier coverage, absence of frame-to-frame feature-owner contradictions and a viable connected camera pose graph. Poor calibration or repeated descriptor disagreement requires **reshoot**, not threshold relaxation.
6. Create a new, independently collected **source-disjoint holdout** after the training capture, on another pass with independent start/trajectory. Keep its frames and hashes sealed from anyone tuning cameras, matching, geometry, or Gaussian hyperparameters. **Never recycle S08** as a fresh blinded acceptance test.

## Required immutable provenance and process

- Record source owner/consent, camera/lens ID, calibration files, each 4K/native image hash, derived resolution/transforms, capture timestamps and matching code SHA. Store in original World001 controlled folders and seal a new train/holdout split before processing.
- Apply reciprocal 2-nearest-neighbor ratio, original <=100 SIFT L2 descriptor distance, geometric constraints, one-to-one image feature ownership, collision rejection, robust triangulation, genuine calibrated intrinsics and global bundle adjustment. Inspect rejected edges by source-reason category; never force a feature into two 3D tracks.
- Re-run the unchanged World001 **>=800 strict consistent landmark criterion**, including independent extra training observations, and the original (or appropriately reauthorized) blinded heldout quality checks. Do not count 4-view graph components without 3D reprojection/descriptor validation as accepted landmarks.
- Only *after* both geometry and independent holdout tests pass, obtain separate written GPU/provider budget authorization with a hard cap and stop rules for a **single** Gaussian trial. Follow with actual render, visual/art, privacy, spatial runtime and physical-device acceptance. Do not commission batches ahead of one certified pilot.

**Current status: CAPTURE REQUIRED / NO GAUSSIAN AUTHORIZED / RELEASE NO-GO.**

## Wave 113: actionable, owner-local capture quality screen

This is an *additional acquisition diagnostic* next to the original
`world001-source-correction-preflight.py`. It cannot replace source authorization,
feature-track consistency, whole-survey holdout, asset approval or paid GPU gates.
No footage or identifiable per-frame measurements are sent to any service.

Before recording, capture a separate physical checkerboard calibration for the
exact camera/lens/focus/resolution being used. Save its SHA-256-pinned evidence,
source ownership/consent evidence, camera ID, lens ID, and scene-authority packet.
Use the original correction manifest schema, with these **additional** fields:

- Each physical session `capture_controls`: `{ "camera_id": "<local id>",
  "lens_id": "<local id>", "focus": "MANUAL_LOCKED",
  "exposure": "MANUAL_LOCKED", "white_balance": "MANUAL_LOCKED" }`.
- Each `calibrations[calibration_id]` must repeat the session `camera_id` and
  `lens_id` and retain distortion status `CALIBRATED_ZERO_OR_RECTIFIED` plus its
  existing independent SHA-256 evidence.
- Every `views[]` item must belong to a known physical train session and match
  its calibration ID; future blind holdout images remain **unmaterialized**
  during training preparation.
- Maintain the original `frozen_acceptance` criteria and historical W4 lock
  unchanged. Keep `paid_compute_authorized=false` and
  `gaussian_training_permitted=false`.

On a locally controlled computer with Python 3 and Pillow installed, run:

```bash
python3 scripts/world001-source-correction-preflight.py \
  --root /PRIVATE/CAPTURE --manifest /PRIVATE/source-manifest.json \
  --trusted-w4-lock /PRIVATE/frozen-w4-lock.json \
  --output /PRIVATE/source-preflight.json
python3 scripts/world001-capture-image-quality.py \
  --root /PRIVATE/CAPTURE --manifest /PRIVATE/source-manifest.json \
  --trusted-w4-lock /PRIVATE/frozen-w4-lock.json \
  --output /PRIVATE/image-quality-screen.json
```

The second command first calls the original correction preflight. It then
reads genuine hash-verified PNG pixels *locally*, checking image intensity,
clipped whites/blacks, p90-p10 contrast, Laplacian-focus estimate, candidate
corner density and directional gradient imbalance, plus locked camera/lens
settings. It reports counts and worst aggregate metrics only, with no source
image names or pixels. Thresholds are deliberately named **provisional
capture-screening heuristics**, not calibrated optical limits or UrAi's frozen
source-geometry acceptance. Manual review and actual SfM still follow.

If any diagnostic flags occur, correct focus/exposure/stabilization/lighting and
recapture that physical session. If frames pass, run the existing real camera
solve and strict 800 landmark threshold, then **new** independent withheld
session evaluation. Do not recycle the historically failed S08 survey for a new
blind acceptance test. No production Gaussian or cloud provisioning follows
without explicit, separate budget and human authorization.

To run only synthetic, no-provider regression tests:

```bash
python3 scripts/world001-capture-image-quality.test.py
```

**Current result: no new physical footage acquired, no complete capture packet
screened, no World001 geometry/holdout/3DGS admission.**
