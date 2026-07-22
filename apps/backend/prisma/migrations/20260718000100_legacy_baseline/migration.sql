-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'DM');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GM', 'PLAYER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('RECORDING', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "NPCStatus" AS ENUM ('ACTIVE', 'DEAD', 'UNKNOWN', 'ALLY', 'ENEMY');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('DISCOVERED', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "emailVerificationTokenHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminApiKeyGrant" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "dmId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminApiKeyGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discordGuildId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordLinkToken" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordInstallation" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "discordName" TEXT,
    "discordDisplayName" TEXT,
    "characterName" TEXT,
    "partyRole" TEXT,
    "avatarUrl" TEXT,
    "characterSheetUrl" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "pauseNote" TEXT,
    "notes" TEXT,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "setting" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "campaignContext" TEXT,
    "backgroundImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "sessionNumber" INTEGER,
    "title" TEXT,
    "sessionImageUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'RECORDING',
    "activeMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "fileSizeBytes" BIGINT,
    "format" TEXT NOT NULL DEFAULT 'mp3',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "npcs" JSONB NOT NULL DEFAULT '[]',
    "quests" JSONB NOT NULL DEFAULT '[]',
    "loot" JSONB NOT NULL DEFAULT '[]',
    "locations" JSONB NOT NULL DEFAULT '[]',
    "openThreads" JSONB NOT NULL DEFAULT '[]',
    "sessionImagePrompt" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakerMap" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordName" TEXT NOT NULL,
    "characterName" TEXT,
    "playerName" TEXT,
    "diarizationLabel" TEXT,

    CONSTRAINT "SpeakerMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSettings" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "whisperProvider" TEXT NOT NULL DEFAULT 'openai',
    "whisperApiKey" TEXT,
    "whisperEndpoint" TEXT,
    "huggingfaceToken" TEXT,
    "replicateApiKey" TEXT,
    "imageGenModel" TEXT NOT NULL DEFAULT 'black-forest-labs/flux-schnell',
    "sessionImageProvider" TEXT,
    "sessionImageModel" TEXT,
    "llmProvider" TEXT NOT NULL DEFAULT 'anthropic',
    "llmApiKey" TEXT,
    "llmModel" TEXT,
    "llmEndpoint" TEXT,
    "summaryLanguage" TEXT NOT NULL DEFAULT 'de',
    "postSummaryChannelId" TEXT,
    "llmSystemPrompt" TEXT,
    "llmCampaignContext" TEXT,

    CONSTRAINT "GroupSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignThread" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "openedInSessionId" TEXT,
    "resolvedInSessionId" TEXT,
    "linkedThreadIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'aggregated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignNPC" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "firstSeenSessionId" TEXT,
    "lastSeenSessionId" TEXT,
    "status" "NPCStatus" NOT NULL DEFAULT 'ACTIVE',
    "sessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'aggregated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignNPC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLocation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'aggregated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignQuest" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuestStatus" NOT NULL DEFAULT 'DISCOVERED',
    "openedInSessionId" TEXT,
    "resolvedInSessionId" TEXT,
    "rewardItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'aggregated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLoot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'aggregated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLoot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AdminApiKeyGrant_superAdminId_dmId_key" ON "AdminApiKeyGrant"("superAdminId", "dmId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_discordGuildId_key" ON "Group"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLinkToken_groupId_key" ON "DiscordLinkToken"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLinkToken_codeHash_key" ON "DiscordLinkToken"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordInstallation_discordGuildId_key" ON "DiscordInstallation"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_sessionId_key" ON "Transcript"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_sessionId_key" ON "Summary"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakerMap_sessionId_discordUserId_key" ON "SpeakerMap"("sessionId", "discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakerMap_sessionId_diarizationLabel_key" ON "SpeakerMap"("sessionId", "diarizationLabel");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSettings_groupId_key" ON "GroupSettings"("groupId");

-- CreateIndex
CREATE INDEX "CampaignThread_campaignId_idx" ON "CampaignThread"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignNPC_campaignId_idx" ON "CampaignNPC"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignNPC_campaignId_name_key" ON "CampaignNPC"("campaignId", "name");

-- CreateIndex
CREATE INDEX "CampaignLocation_campaignId_idx" ON "CampaignLocation"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLocation_campaignId_name_key" ON "CampaignLocation"("campaignId", "name");

-- CreateIndex
CREATE INDEX "CampaignQuest_campaignId_idx" ON "CampaignQuest"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignLoot_campaignId_idx" ON "CampaignLoot"("campaignId");

-- AddForeignKey
ALTER TABLE "AdminApiKeyGrant" ADD CONSTRAINT "AdminApiKeyGrant_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApiKeyGrant" ADD CONSTRAINT "AdminApiKeyGrant_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordLinkToken" ADD CONSTRAINT "DiscordLinkToken_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakerMap" ADD CONSTRAINT "SpeakerMap_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSettings" ADD CONSTRAINT "GroupSettings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThread" ADD CONSTRAINT "CampaignThread_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThread" ADD CONSTRAINT "CampaignThread_openedInSessionId_fkey" FOREIGN KEY ("openedInSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignThread" ADD CONSTRAINT "CampaignThread_resolvedInSessionId_fkey" FOREIGN KEY ("resolvedInSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNPC" ADD CONSTRAINT "CampaignNPC_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNPC" ADD CONSTRAINT "CampaignNPC_firstSeenSessionId_fkey" FOREIGN KEY ("firstSeenSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignNPC" ADD CONSTRAINT "CampaignNPC_lastSeenSessionId_fkey" FOREIGN KEY ("lastSeenSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLocation" ADD CONSTRAINT "CampaignLocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuest" ADD CONSTRAINT "CampaignQuest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuest" ADD CONSTRAINT "CampaignQuest_openedInSessionId_fkey" FOREIGN KEY ("openedInSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuest" ADD CONSTRAINT "CampaignQuest_resolvedInSessionId_fkey" FOREIGN KEY ("resolvedInSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLoot" ADD CONSTRAINT "CampaignLoot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
