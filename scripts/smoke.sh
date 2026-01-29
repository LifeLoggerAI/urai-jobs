#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
LOG="/tmp/urai_jobs_smoke_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

kill_tree() {
  local pid="$1"
  (pkill -P "$pid" 2>/dev/null || true)
  (kill "$pid" 2>/dev/null || true)
}

echo "== smoke: build first =="
pnpm build

echo "== smoke: start server (PORT=$PORT) =="
PORT="$PORT" pnpm start >/tmp/urai_jobs_start_${PORT}.log 2>&1 &
PID=$!

for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null
curl -fsS "http://127.0.0.1:${PORT}/api/health" | head -c 800 || true
echo

# optional second route
curl -fsS "http://127.0.0.1:${PORT}/admin" >/dev/null || true

echo "== smoke OK =="
kill_tree "$PID"
echo "LOG=$LOG"
