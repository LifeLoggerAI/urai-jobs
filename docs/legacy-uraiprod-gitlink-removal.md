# UrAiProd legacy gitlink removal

## Authority

This branch removes only the obsolete repository-tree gitlink at `UrAiProd` from Jobs authority `6edbd6430ee4167837e2f491b074d43a1892a759`.

The removal is owner-authorized and is supported by retained diagnostic evidence from issue #81 and diagnostic PR #82:

- former mode: `160000`
- former object: `ea4704699b14666758df49758b0fbcd8aa99bc38`
- `.gitmodules`: absent
- accessible legacy repository could not resolve the target object
- no application, Firebase, package, deployment or rollback consumer was found

## Scope

- delete only the `UrAiProd` gitlink entry;
- preserve all Git history and retained workflow artifacts;
- do not reconnect the path to a substitute SHA;
- do not restore legacy deployment authority;
- preserve `UrAiProd` as quarantined historical evidence.

## Validation

The pull request must prove:

1. `git ls-tree HEAD -- UrAiProd` returns no entry;
2. `.gitmodules` remains absent;
3. no non-documentation source, package, Firebase, deployment or rollback consumer references `UrAiProd`;
4. the complete Jobs exact-head workflow matrix remains green;
5. no provider, credential, billing, IAM or production-data mutation occurs.

## Rollback

Rollback is a repository-only revert of the removal commit. Reverting restores the historical gitlink object exactly as recorded above, but does not make it a valid submodule or production dependency. Any rollback must remain quarantined and must not reconnect the object to an invented repository or substitute commit.

## Production authority

This change removes an invalid legacy tree entry only. It does not alter current application authority, Firebase configuration, deployed Functions, provider delivery, production domains or production data.
