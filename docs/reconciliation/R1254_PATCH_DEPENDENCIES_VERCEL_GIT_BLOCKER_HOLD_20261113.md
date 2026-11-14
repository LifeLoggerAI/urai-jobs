# CHALK R1254 — scoped transitive dependency fixes and Vercel live-preview blocker (HOLD)

Execution date: 2026-11-13 Central / 2026-11-14 UTC. Parent Jobs #505 merged review commit `a08a4c14c9756578b9f40f3574b5f06a75a0e8d7`.

Four targeted pnpm overrides and regenerated frozen lockfile only:
- `tmp@0.2.5 -> 0.2.6`
- `form-data@2.5.5 -> 2.5.6`
- `ip-address@10.2.0 -> 10.3.1`
- `body-parser@1.20.4 -> 1.20.9`

The re-resolution also adjusts transitive `qs`, `hasown` and `side-channel` dependencies as required by the patched set. No first-party runtime code, Firestore/Storage Rules, GCS IAM, user data or consent authority changes.

Actual original tests on existing Runpod R950 worker `bvandlyauxhevl` using isolated `/tmp/urai-r1254/jobs`, exact merged parent:
- `pnpm@8.15.9 install --lockfile-only --ignore-scripts` exit 0.
- `pnpm@8.15.9 install --frozen-lockfile` exit 0; install log SHA256 `865f8ab37a94b552b5b091dd06aa6fe3bd864d59f81c882698afff14f3aeb548`.
- `pnpm@8.15.9 --filter urai-jobs-functions build` exit 0; build log SHA256 `ae2e996d7c4b65480d5f23969129758848e611053f8d0cc5dcec2f7994321743`.
- Original storage writer-separation/session cancellation canaries `node --test scripts/review-only/r1088-writer-separation-canary.test.mjs scripts/review-only/r1122-gcs-session-cancel-canary.test.mjs`: **24/24 PASS**, exit 0; TAP SHA256 `e9cdf911c22d7a7650842879412db611791359b00c2009daeb785c5bf6566f0f`.
- Production dependency audit `pnpm audit --prod --json`: exit **1**, 0 critical, **7 high**, 25 moderate, 6 low. Previous Jobs #505 review merge audit had 10 high, 27 moderate, 7 low. Full JSON SHA256 `06936de172846f3ef4b5257c7b1f18938e357fff5467407743714395dff083f2`. This is a real improvement, **not** audit clearance.
- Exact source blobs: `package.json` = `7b46a5f8a9c39b215d90a890a9b3f057f3424c5a`; `pnpm-lock.yaml` = `75a3b9b5ce4e492fcd21c9d04b49245ace8e6d07`; authenticated GitHub writes matched both.

**Separate live deployment gate:** Checked Vercel team `team_w8p5bf3ufFzHRnb9QykJmjVR` and private SSO project `prj_pt7oOQLnCFki8vJb4ph9XhIjiLwZ` (`urai-genesis-private-app-review-r1193`), with SSO enabled across all deployments. Its prior production-target deployment `dpl_D75mw6V33S3XdxjK3bucKcLYtiyN` is **ERROR** `git_info_fail` from an older Spatial PR head `50385989a324ec84809ab3b50d23f3e85903d3bc`. Explicit preview-only deployment targeting verified Spatial review merged commit `791bd415030b2755030134dff41908af9de10e7d` was rejected by Vercel API **HTTP 400 no_github_account_connected**. A separate Git namespace request got **401 github_response_error**. Existing R950 worker has no Vercel CLI, and no bearer token or credential was retrieved or printed. No new preview/deployment, alias or production mutation occurred. Required user/provider action: restore GitHub integration authorization in Vercel; then deploy exact private preview and inspect it. Do not use prior unrelated Vercel READY project as proof of integrated Genesis.

**Release boundary:** review-only code changes, not certified. Protected GitHub CI startup failures; 7 high vulnerabilities remain; independent qualified reviewer approval, live sole GCS broker-writer/stale-session drain/physical generation delete evidence, authenticated real positive owner consent→Studio→Jobs→Replay→deletion, credential incident closure, protected hosted preview, device/Spatial/store acceptance and founder GO remain outstanding. **HOLD_NO_GO; all 11 launch gates BLOCKED; private-memory writes DISABLED. No main merge, production alias or provider data-plane enablement.**
