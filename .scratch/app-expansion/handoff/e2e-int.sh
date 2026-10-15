#!/bin/bash
# usage: e2e-int.sh <workers> <spec...>  — fresh DB vietnam_aesthetic_tint, prod server on 3190 in the integration worktree
set -u
WT=/home/noah/Desktop/project/dev_busi/vietnam_massage-integration
cd $WT
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:3450/vietnam_aesthetic_tint DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:3450/vietnam_aesthetic_tint
export NEXTAUTH_SECRET=integration-e2e-secret-0123456789abcdef NEXTAUTH_URL=http://127.0.0.1:3190 PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_PORT=3190
W=$1; shift
ss -ltnp "sport = :3190" | grep -q LISTEN && { echo "port 3190 busy"; exit 1; }
docker exec vietnam-shell-02-e2e psql -U postgres -d postgres -q -c "DROP DATABASE IF EXISTS vietnam_aesthetic_tint WITH (FORCE);" -c "CREATE DATABASE vietnam_aesthetic_tint;" >/dev/null
npx prisma migrate deploy >/dev/null 2>&1 && npx tsx scripts/seed-dev-accounts.ts >/dev/null 2>&1 && npx tsx scripts/seed-master-data.ts >/dev/null 2>&1 || { echo "db setup failed"; exit 1; }
setsid -f npx next start --hostname 127.0.0.1 --port 3190 > /tmp/vietnam-int-server.log 2>&1
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:3190/login && break; sleep 1; done
PID=$(ss -ltnp "sport = :3190" | grep -oP 'pid=\K[0-9]+' | head -1)
echo "server pid=$PID cwd=$(readlink /proc/$PID/cwd)"
npx playwright test --workers=$W --reporter=line "$@" 2>&1 | tail -25
[ "$(readlink /proc/$PID/cwd)" = "$WT" ] && kill $PID && echo "stopped $PID"
