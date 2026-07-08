#!/bin/sh
echo "Running Prisma DB push..."
npx prisma db push --schema ./prisma/schema.prisma --skip-generate 2>&1
echo "Starting backend..."
exec node dist/index.js
