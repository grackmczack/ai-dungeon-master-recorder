import { PrismaClient } from "@prisma/client";
import process from "node:process";

const prisma = new PrismaClient();
try {
  const [state] = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('public."Group"') IS NOT NULL AS "hasLegacyGroup",
      to_regclass('public."_prisma_migrations"') IS NOT NULL AS "hasMigrationTable"
  `);
  if (state?.hasLegacyGroup && !state?.hasMigrationTable) process.exitCode = 10;
} finally {
  await prisma.$disconnect();
}
