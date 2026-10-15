#!/usr/bin/env bash
# Run from the worktree whose production build is being verified.
# Usage: bash .scratch/app-expansion/validation/run-e2e.sh <workers> <run-name> [Playwright args...]
set -euo pipefail
wt=$(pwd -P)
workers=$1
run_name=$2
shift 2
run_dir="$wt/.scratch/app-expansion/validation/$run_name"
mkdir -p "$run_dir"
export CI=1
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:3450/vietnam_aesthetic_trf
export DIRECT_DATABASE_URL="$DATABASE_URL"
export NEXTAUTH_SECRET=review-e2e-secret-0123456789abcdef
export NEXTAUTH_URL=http://127.0.0.1:3180
export PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_PORT=3180
export PLAYWRIGHT_JSON_OUTPUT_FILE="$run_dir/results.json"
if ss -ltn 'sport = :3180' | tail -n +2 | read -r _; then
  echo 'Port 3180 is occupied; no process was changed.'
  exit 1
fi
# No FORCE: another live connection prevents accidental DB removal.
docker exec vietnam-shell-02-e2e psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c 'DROP DATABASE IF EXISTS vietnam_aesthetic_trf;' -c 'CREATE DATABASE vietnam_aesthetic_trf;' >"$run_dir/db.log" 2>&1
pnpm exec prisma migrate deploy >>"$run_dir/db.log" 2>&1
pnpm exec tsx scripts/seed-dev-accounts.ts >>"$run_dir/db.log" 2>&1
pnpm exec tsx scripts/seed-master-data.ts >>"$run_dir/db.log" 2>&1
setsid -f pnpm exec next start --hostname 127.0.0.1 --port 3180 >"$run_dir/server.log" 2>&1
server_pid=''
stop_server() {
  if [ -n "$server_pid" ] && [ "$(readlink "/proc/$server_pid/cwd" 2>/dev/null || true)" = "$wt" ]; then
    kill "$server_pid"
  fi
}
trap stop_server EXIT
for _ in $(seq 1 60); do
  server_pid=$(ss -ltnp 'sport = :3180' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
  if [ -n "$server_pid" ] && curl -fsS -o /dev/null http://127.0.0.1:3180/sign-in; then break; fi
  sleep 1
done
if ! curl -fsS -o /dev/null http://127.0.0.1:3180/sign-in || [ -z "$server_pid" ] || [ "$(readlink "/proc/$server_pid/cwd")" != "$wt" ]; then
  echo 'Expected server did not start.'
  exit 1
fi
echo "$server_pid" >"$run_dir/server.pid"
pnpm exec playwright test --workers="$workers" --retries=0 --reporter=line,json "$@" >"$run_dir/output.log" 2>&1
