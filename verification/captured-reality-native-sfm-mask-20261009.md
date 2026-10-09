# Source-bound native camera masks

The current Captured Reality engine copied admitted masks only after `ns-process-data` had completed COLMAP. Dynamic excluded pixels could therefore influence camera features and camera solving even though radiance training subsequently used masks.

This scoped donor prepares the complete admitted per-view mask set before camera processing, validates full source/mask bytes and native dimensions, and forwards `--ImageReader.mask_path` through the reviewed Nerfstudio 1.1.5 `--colmap-cmd` interface. COLMAP receives masks named for the complete processed image name plus `.png`. A hash-bound application receipt is required before training. Missing coverage, changed source/mask/authority bytes, malformed or truncated PNG pixels, resized images and a mask-flag override fail before native feature extraction. No static mask is synthesized.

Fresh existing-owner observation: PR #170 at `2d3a8fb3ea2791efe1ff4407eb9ca65375c4a750`. Its four changed existing blobs match the directly fetched parent: engine `ff637185f08036882ffbe972f724a71a9ad6378b`, masks `39f04c9bd28b2314b6701c50d364885658f79a39`, Docker recipe `6a180129fdf66e419b3636dfc030eea304fe8d00`, engine contract `ed7da716fed1ec59ef4e8a46a04037eeae9895e8`. The donor targets the existing convergence branch and does not change main or another workstream.

Actual bounded verification on Node 22.23.3 / Python 3.12.14:

- The exact predecessor engine fails the added pre-camera masked-command invariant. The corrected existing engine/resolver contract passes, including synthetic budget, admission, revocation, deletion, callback, replay and holdout controls.
- `python3 scripts/captured-reality-sfm-mask.test.py -v`: 12 passed. This includes a valid-CRC PNG with truncated IDAT pixels; full decoding rejects it before the native subprocess is called. Native subprocess execution in this suite is explicitly adapted.
- Existing `captured-reality-mask-contract.mjs` and `captured-reality-holdout-contract.mjs` pass. Changed JavaScript syntax and `git diff --check` pass.
- The unmodified official Nerfstudio 1.1.5 `run_colmap` command builder was executed in isolation from the official wheel (SHA256 `ee6d3d360a1e363ad2f1703b602da5a8987485bff812d0ae8aa4a6e672b994c4`); heavy SDK imports and native CLI invocation were explicit adapters. The supported command prefix and native mask argument were verified.
- Actual official CPU COLMAP 3.13.0 feature extraction on three synthetic 512x512 textured views produced 392 / 424 / 0 features with upper-half / lower-half / all-zero masks. All feature centers stayed outside zero-mask pixels. No camera solve or training was repeated for this check.
- A separate agent performed bounded read-only peer review and independently reran the truncated-IDAT and changed-authority regressions. This is not independent release approval.

The source/job/lease/consent/deletion monitor, fixed-job prepaid reservation, deadline, zero automatic training retries, reserved radiance splits, private delivery and unaccepted-world receipts are preserved. Docker preparation requires native COLMAP mask-option support. This donor does not certify a built container, loaded complete SDK, native COLMAP CLI, real provider/GPU execution, deployed parity, family-world navigation or accepted reconstruction. Those remain actual acceptance requirements.

Primary semantics: [COLMAP mask image regions](https://colmap.github.io/faq.html#mask-image-regions); reviewed official Nerfstudio 1.1.5 `colmap_utils.py`, `images_to_nerfstudio_dataset.py` and `colmap_converter_to_nerfstudio_dataset.py` sources in the pinned distribution.
