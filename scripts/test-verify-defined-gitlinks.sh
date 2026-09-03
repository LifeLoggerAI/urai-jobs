#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
verifier="$script_dir/verify-defined-gitlinks.sh"
test_repo=$(mktemp -d)
trap 'rm -rf "$test_repo"' EXIT

git -C "$test_repo" init -q
git -C "$test_repo" config user.name "UrAi CI"
git -C "$test_repo" config user.email "ci@urai.invalid"

cat > "$test_repo/.gitmodules" <<'EOF'
[submodule "decoy"]
  path = foo
  url = https://example.invalid/decoy.git
EOF
printf 'regular file\n' > "$test_repo/foo"
git -C "$test_repo" add .gitmodules foo
git -C "$test_repo" commit -q -m "Create decoy path"

gitlink_object=$(git -C "$test_repo" rev-parse HEAD)
git -C "$test_repo" update-index --add --cacheinfo 160000,"$gitlink_object","foo bar"
git -C "$test_repo" commit -q -m "Add undefined spaced gitlink"

if (cd "$test_repo" && bash "$verifier" HEAD); then
  echo "Verifier accepted an undefined gitlink whose path contains a space." >&2
  exit 1
fi

cat >> "$test_repo/.gitmodules" <<'EOF'
[submodule "spaced"]
  path = foo bar
  url = https://example.invalid/spaced.git
EOF
git -C "$test_repo" add .gitmodules
git -C "$test_repo" commit -q -m "Define spaced gitlink"

(cd "$test_repo" && bash "$verifier" HEAD)
echo "Complete-path gitlink regression: PASS"
