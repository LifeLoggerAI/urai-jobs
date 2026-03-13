#!/bin/bash

set -e

echo "Installing dependencies..."
pnpm install

echo "Running typecheck..."
pnpm typecheck

echo "Running lint..."
pnpm lint

echo "Running tests..."
pnpm test

echo "Running smoke test..."
pnpm smoke

echo "Starting emulators..."
firebase emulators:start
