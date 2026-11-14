# CHALK R1267 — Firebase Admin 11 legacy multipart transitive dependency security review (HOLD)

Parent Jobs #508 merged review commit: `1afeeb262824c8c440632e9d4b4d7bb04c229fd4`. Scope: add scoped pnpm override `@fastify/busboy@1.2.1: 3.2.1` and regenerate frozen lockfile. **Major-version jump**, therefore this remains review-only pending independent security and actual Firebase cloud validation. No first-party app logic, IAM, Firestore rules, private GCS writes, or runtime permission gates changed.

Exact candidate Git source blobs: package `417539237f3b5398f411a1a36e035ed0ab2476a9`; pnpm-lock `a1b8d2e76c409e21e0fe85aed16671013c289a0a`.

The original isolated R950 workspace `/tmp/urai-r1267/jobs`, based on Jobs #508:
- `pnpm@8.15.9 install --frozen-lockfile` exit 0; log SHA256 `9b2503918de3c86c6290f217e6c0ba092013ca1e7a75db2f289fb870974706fc`.
- Functions build exit 0; log SHA256 `1a9bc4640f6421ba66b5206d7b73801552d8e725650869cb7f4ceb9da30fded`.
- Original GCS writer-separation/session-cancel canaries 24/24 PASS; TAP SHA256 `adf625e149b93c837c7d7864dfb006c3f94f7d28184f9f6ac80b5c5803edee74`.
- All four affected worker builds PASS: asset (SHA256 `f1b98cae9e44df5aa295aae54c5d40b0dc6e2b5fb7426a816a5f2e9e75df7593`), studio (`2e5e8907c266972e25bd35c846e2ad45939567568a5b0a56b2fdf664474e4224`), spatial (`687713a99e11cecfb8edeab4cf97d2188b302d9bbae20c9a7ccab3910b2dab6e`), narrator (`3399a0f788f2f53ea97fc37afe3f5504d72508333865006fb5d76d0fc375d58a`).
- Firebase Admin 11.11.1 uses `new busboy.Dicer({boundary})` in its multipart HTTP response parser. With v3.2.1 resolved **through the actual Firebase Admin dependency graph**, `Dicer` exports a constructor. A synthetic two-part boundary fixture `alpha` and `beta` round-tripped through its streaming part parsing. This is only a focused runtime compatibility test, not full cloud coverage.
- `pnpm audit --prod --json` **exit 1**, high **2**, moderate 24, low 5, critical 0. Prior Jobs #508 had high 3, moderate 25, low 5. Original audit SHA256 `004d9a7e3f239f2b4280e31d8848889ba377b9e18c77eca23d27bda908b7869e`. Remaining high: lodash 4.17.23 and Zod 3.25.76. Audit NOT clean.

**Required next checks:** exact GitHub PR head frozen install, build, 24/24 canaries and the Firebase Admin Dicer multipart fixture, then the resulting *review-only* merge commit. The risk of a major version replacement must be disclosed. Consider a same-major Firebase Admin package upgrade or upstream compatibility review before production. Do not claim external security approval.

**Live blockers:** private Genesis Vercel project `prj_pt7oOQLnCFki8vJb4ph9XhIjiLwZ` is SSO-protected but NOT live, only deployment ERROR; GitHub link absent, preview rejected `no_github_account_connected`. GitHub Actions protected CI failed at current review commits. Signed owner-positive consent→Studio→Jobs→Replay→physical delete, effective GCS sole writer/old writer stale PUT/draining/generation delete, credential incident closure, qualified independent review, Spatial/device/stores and founder GO are outstanding.

**Production HOLD_NO_GO. All 11 release gates BLOCKED. Private-memory writes DISABLED. No main or production promotion.**
