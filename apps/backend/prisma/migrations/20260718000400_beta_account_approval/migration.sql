-- Bestehende Konten bleiben freigeschaltet. Neue öffentliche Registrierungen
-- setzen approvedAt explizit auf NULL, bis ein Superadmin sie bestätigt.
ALTER TABLE "User"
  ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "User"
SET "approvedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NOT NULL;

ALTER TABLE "User"
  ALTER COLUMN "approvedAt" SET DEFAULT CURRENT_TIMESTAMP;
