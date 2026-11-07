# Jobs complete accessible tracked-tree inventory — R845

**Current code review snapshot:** Jobs #320 commit `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, recursive tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. The GitHub recursive tree returned `truncated=false`. Machine-readable **all 1,177 tracked blob paths** are in [MANIFEST.json](MANIFEST.json), with Git object SHA, size, mode and explicit coverage status.

- 1,177 files; 216 tree directories; 5,137,055 Git-reported bytes; 831 distinct blob SHA-1 identities; 346 repeated path-instance identities. 1,176 regular modes and one executable mode (`audit_and_fix.sh`); no gitlink or symlink modes in this tree.
- Historical `_audit/` subtree contains 513 tracked files / 1,228,916 reported bytes, including retained older compiled sources. Preserve all; duplicate blob identities are not deletion authorization.
- `main` `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`: 1,049 files, 208 dirs, 3,984,910 reported bytes. Compared with exact `urai-labs-llc` registry baseline: 1,049/1,049 path, byte length and SHA metadata agree, zero drift. Candidate #320 is 1,008 unchanged, 41 modified, 128 added, **zero removed** paths compared to main.
- 109/109 Markdown documents and 22/22 GitHub workflow bodies fetched in previous R840–R842 investigations (semantic review not exhaustive). 297 branch names and 283 PR metadata were previously recorded; these are time-bounded counts, not exhaustive all-account, all-commit history.

**New actual-byte verification:** GitHub blob `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76` (`workers/studio-worker/private-output-write-authority.js`) independently decoded as 1,011 UTF-8 bytes; rehashed canonical Git object `blob 1011\0...` to the same SHA-1, and byte SHA-256 to `a8a1a6fa86574bed3f1e2d9c7db305a12b3f238c066d37c023be199720cf6075`. This is one independently verified blob, **not 1,177**. Other Git IDs are still provider-reported metadata.

**Not covered:** all Git reachable/unreachable objects, all branch versions, packed physical bytes, ignored/untracked files, external cloud/LFS payloads, past deleted refs, full test logs, verified digest of other file bodies. No complete clone is available in this audit container; DNS for github.com fails. Use a network-capable authorized mirror and full collector before a raw-byte certificate.

[Exact Git tree](https://api.github.com/repos/LifeLoggerAI/urai-jobs/git/trees/3e74b4b0d6e10df15f9ccd747e9e936218b7fc25?recursive=1).
