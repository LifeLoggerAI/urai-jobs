#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Build and watch functions
npm --prefix functions run build -- --watch &

# Start emulators
firebase emulators:start
