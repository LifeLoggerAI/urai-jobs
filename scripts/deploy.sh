#!/bin/bash
set -euo pipefail
set +H

firebase deploy --only functions,firestore
