#!/bin/bash
set -euo pipefail
set +H

(cd functions && npm test)
