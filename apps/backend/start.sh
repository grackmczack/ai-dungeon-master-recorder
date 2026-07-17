#!/bin/sh
set -e

echo "Running Prisma DB push..."
npx prisma db push --schema ./prisma/schema.prisma --skip-generate
echo "Starting backend..."
exec node dist/index.js
