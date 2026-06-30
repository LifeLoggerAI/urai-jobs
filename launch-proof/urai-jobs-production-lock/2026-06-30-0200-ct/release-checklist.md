# Release Checklist

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

Done in source:

- Branch created.
- Inline fallback gated outside local/emulator.
- Worker auth added for narrator execution route.
- Web admin/create route guards added.
- Public nav hides admin/create unless authorized.
- createJob source hardening added.
- Env docs updated.
- Integration statuses aligned.
- Proof folder created.

Still required before READY:

- CI green.
- Emulator lifecycle proof attached.
- Staging deployment proof attached.
- Staging real worker artifact proof attached.
- Retry/fail/cancel proof attached.
- Monitoring and rollback proof attached.
- Minimal production smoke proof attached after staging passes.
