#!/bin/sh
# Migration-on-deploy entrypoint for the unified backend.
# Applies Prisma migrations for BOTH databases, optionally seeds reference data,
# then hands off to the container CMD (node dist/server.js).
set -e

echo "[entrypoint] applying IT (ticketing) migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma

echo "[entrypoint] applying Maintenance migrations..."
npx prisma migrate deploy --schema maintenance/prisma/schema.prisma

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[entrypoint] seeding IT reference data..."
  npx tsx prisma/seed.ts || echo "[entrypoint] IT seed skipped/failed (continuing)"
  if [ -f maintenance/seed.js ]; then
    echo "[entrypoint] seeding Maintenance reference data..."
    node maintenance/seed.js || echo "[entrypoint] Maintenance seed skipped/failed (continuing)"
  fi
fi

echo "[entrypoint] starting: $*"
exec "$@"
