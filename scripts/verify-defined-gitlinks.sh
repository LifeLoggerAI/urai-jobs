#!/usr/bin/env bash
set -euo pipefail

treeish=${1:-HEAD}
mapfile -t gitlinks < <(git ls-tree -r "$treeish" | awk '$1 == "160000" { print $4 }')

if ((${#gitlinks[@]} == 0)); then
  echo "No gitlinks present in $treeish."
  exit 0
fi

test -f .gitmodules || {
  printf 'Undefined gitlinks require .gitmodules: %s\n' "${gitlinks[*]}" >&2
  exit 1
}

for path in "${gitlinks[@]}"; do
  name=$(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' |
    awk -v path="$path" '$2 == path { sub(/^submodule\./, "", $1); sub(/\.path$/, "", $1); print $1 }')
  test -n "$name" || { echo "No .gitmodules entry for $path" >&2; exit 1; }
  url=$(git config -f .gitmodules --get "submodule.$name.url")
  branch_name=$(git config -f .gitmodules --get "submodule.$name.branch" || true)
  test -n "$url" || { echo "No URL for $path" >&2; exit 1; }
  test -z "$branch_name" || { echo "Branch-following submodule forbidden for $path" >&2; exit 1; }
  object=$(git ls-tree "$treeish" "$path" | awk '{print $3}')
  [[ "$object" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid immutable object for $path" >&2; exit 1; }
done
