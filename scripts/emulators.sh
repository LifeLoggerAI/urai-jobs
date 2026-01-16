#!/bin/bash
set -euo pipefail
set +H

firebase emulators:start --import=./fb-emulator-data --export-on-exit
