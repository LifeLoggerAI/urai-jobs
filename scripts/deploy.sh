#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Build functions
npm --prefix functions run build

# Deploy to Firebase
firebase deploy --only functions,firestore,storage
