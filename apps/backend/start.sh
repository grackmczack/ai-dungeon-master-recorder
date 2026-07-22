#!/bin/sh
set -e

echo "Preparing database migrations..."
if node ./prisma/detect-legacy.mjs; then
  :
else
  status=$?
  if [ "$status" -eq 10 ]; then
    echo "Legacy database detected; recording the non-destructive baseline..."
    npx prisma migrate resolve --schema ./prisma/schema.prisma --applied 20260718000100_legacy_baseline
  else
    exit "$status"
  fi
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma
echo "Starting backend..."
exec node dist/index.js
