-- Gruppen waren in der bisherigen Datenstruktur nur eine zusätzliche Hülle
-- um genau eine Kampagne. Die Migration entfernt diese Hülle, übernimmt alle
-- Memberships und Einstellungen und führt kanalgenaue Discord-Bindings ein.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Group" g
    LEFT JOIN "Campaign" c ON c."groupId" = g.id
    GROUP BY g.id
    HAVING COUNT(c.id) <> 1
  ) THEN
    RAISE EXCEPTION 'Campaign migration requires exactly one campaign per legacy group';
  END IF;
END $$;

-- Gruppenbeschreibung und alter KI-Kontext bleiben an der Kampagne erhalten.
UPDATE "Campaign" c
SET
  "name" = CASE
    WHEN BTRIM(c."name") = '' OR LOWER(BTRIM(c."name")) ~ '^kampagne( [0-9]+)?$'
      THEN g."name"
    ELSE c."name"
  END,
  "description" = CASE
    WHEN c."description" ILIKE 'Auto-erstellt%'
      THEN NULLIF(BTRIM(g."description"), '')
    ELSE COALESCE(c."description", NULLIF(BTRIM(g."description"), ''))
  END,
  "campaignContext" = COALESCE(c."campaignContext", gs."llmCampaignContext")
FROM "Group" g
LEFT JOIN "GroupSettings" gs ON gs."groupId" = g.id
WHERE c."groupId" = g.id;

-- Memberships werden ohne neue IDs direkt an die bisher einzige Kampagne
-- gehängt. Dadurch bleiben activeMemberIds bestehender Sessions gültig.
ALTER TABLE "GroupMembership" DROP CONSTRAINT "GroupMembership_groupId_fkey";
ALTER TABLE "GroupMembership" ADD COLUMN "campaignId" TEXT;
UPDATE "GroupMembership" gm
SET "campaignId" = c.id
FROM "Campaign" c
WHERE c."groupId" = gm."groupId";
ALTER TABLE "GroupMembership" ALTER COLUMN "campaignId" SET NOT NULL;
ALTER TABLE "GroupMembership" DROP COLUMN "groupId";
ALTER TABLE "GroupMembership" RENAME TO "CampaignMembership";
ALTER TABLE "CampaignMembership" RENAME CONSTRAINT "GroupMembership_pkey" TO "CampaignMembership_pkey";
ALTER TABLE "CampaignMembership" RENAME CONSTRAINT "GroupMembership_userId_fkey" TO "CampaignMembership_userId_fkey";
ALTER TABLE "CampaignMembership"
  ADD CONSTRAINT "CampaignMembership_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CampaignMembership_campaignId_idx" ON "CampaignMembership"("campaignId");
CREATE INDEX "CampaignMembership_userId_idx" ON "CampaignMembership"("userId");

-- Kampagneneinstellungen übernehmen; llmCampaignContext liegt nun direkt an
-- Campaign und wird deshalb nicht als doppelte Spalte weitergeführt.
ALTER TABLE "GroupSettings" DROP CONSTRAINT "GroupSettings_groupId_fkey";
-- `prisma db push` hat diesen Schlüssel in Produktion als Constraint angelegt,
-- der Migrations-Baseline-Diff dagegen als eigenständigen Unique-Index.
ALTER TABLE "GroupSettings" DROP CONSTRAINT IF EXISTS "GroupSettings_groupId_key";
DROP INDEX IF EXISTS "GroupSettings_groupId_key";
ALTER TABLE "GroupSettings" ADD COLUMN "campaignId" TEXT;
UPDATE "GroupSettings" gs
SET "campaignId" = c.id
FROM "Campaign" c
WHERE c."groupId" = gs."groupId";
ALTER TABLE "GroupSettings" ALTER COLUMN "campaignId" SET NOT NULL;
ALTER TABLE "GroupSettings" DROP COLUMN "groupId";
ALTER TABLE "GroupSettings" DROP COLUMN "llmCampaignContext";
ALTER TABLE "GroupSettings" RENAME TO "CampaignSettings";
ALTER TABLE "CampaignSettings" RENAME CONSTRAINT "GroupSettings_pkey" TO "CampaignSettings_pkey";
CREATE UNIQUE INDEX "CampaignSettings_campaignId_key" ON "CampaignSettings"("campaignId");
ALTER TABLE "CampaignSettings"
  ADD CONSTRAINT "CampaignSettings_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Die Installation bleibt serverweit, Bindings verbinden sie mit Kampagne,
-- Voice-Channel und Summary-Channel.
CREATE TABLE "CampaignDiscordBinding" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "discordInstallationId" TEXT NOT NULL,
  "voiceChannelId" TEXT,
  "voiceChannelName" TEXT,
  "summaryChannelId" TEXT,
  "summaryChannelName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignDiscordBinding_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CampaignDiscordBinding" (
  "id", "campaignId", "discordInstallationId", "summaryChannelId",
  "isActive", "isDefault", "createdAt", "updatedAt"
)
SELECT
  'migrated_' || md5(c.id || ':' || di.id),
  c.id,
  di.id,
  gs."postSummaryChannelId",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Campaign" c
JOIN "Group" g ON g.id = c."groupId"
JOIN "DiscordInstallation" di ON di."discordGuildId" = g."discordGuildId"
LEFT JOIN "CampaignSettings" gs ON gs."campaignId" = c.id
WHERE g."discordGuildId" IS NOT NULL;

CREATE UNIQUE INDEX "CampaignDiscordBinding_discordInstallationId_voiceChannelId_key"
  ON "CampaignDiscordBinding"("discordInstallationId", "voiceChannelId");
CREATE INDEX "CampaignDiscordBinding_campaignId_idx" ON "CampaignDiscordBinding"("campaignId");
CREATE INDEX "CampaignDiscordBinding_discordInstallationId_isActive_idx"
  ON "CampaignDiscordBinding"("discordInstallationId", "isActive");
ALTER TABLE "CampaignDiscordBinding"
  ADD CONSTRAINT "CampaignDiscordBinding_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDiscordBinding"
  ADD CONSTRAINT "CampaignDiscordBinding_discordInstallationId_fkey"
  FOREIGN KEY ("discordInstallationId") REFERENCES "DiscordInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session" ADD COLUMN "discordBindingId" TEXT;
ALTER TABLE "Session" ADD COLUMN "discordVoiceChannelId" TEXT;
ALTER TABLE "Session" ADD COLUMN "discordTextChannelId" TEXT;
UPDATE "Session" s
SET "discordBindingId" = b.id
FROM "CampaignDiscordBinding" b
WHERE b."campaignId" = s."campaignId"
  AND EXISTS (
    SELECT 1 FROM "DiscordInstallation" di
    WHERE di.id = b."discordInstallationId" AND di."discordGuildId" = s."discordGuildId"
  );
CREATE INDEX "Session_discordBindingId_idx" ON "Session"("discordBindingId");
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_discordBindingId_fkey"
  FOREIGN KEY ("discordBindingId") REFERENCES "CampaignDiscordBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Alte, kurzlebige Link-Tokens werden bewusst ungültig. Neue Tokens hängen
-- direkt an der Installation und nicht mehr an einer Gruppenhülle.
DROP TABLE "DiscordLinkToken";
CREATE TABLE "DiscordLinkToken" (
  "id" TEXT NOT NULL,
  "discordInstallationId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscordLinkToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscordLinkToken_discordInstallationId_key"
  ON "DiscordLinkToken"("discordInstallationId");
CREATE UNIQUE INDEX "DiscordLinkToken_codeHash_key" ON "DiscordLinkToken"("codeHash");
ALTER TABLE "DiscordLinkToken"
  ADD CONSTRAINT "DiscordLinkToken_discordInstallationId_fkey"
  FOREIGN KEY ("discordInstallationId") REFERENCES "DiscordInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_groupId_fkey";
ALTER TABLE "Campaign" DROP COLUMN "groupId";
DROP TABLE "Group";

COMMIT;
