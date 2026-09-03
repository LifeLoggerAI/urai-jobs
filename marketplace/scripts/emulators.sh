#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Starting URAI Jobs marketplace emulators"
echo "Production launch remains gated."

firebase emulators:start --config firebase.json
