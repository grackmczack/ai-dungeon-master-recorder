CREATE TYPE "AnalyticsOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "AnalyticsIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "revocationTokenHash" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEventOutbox" (
    "id" TEXT NOT NULL,
    "analyticsIdentityId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "deduplicationKey" TEXT NOT NULL,
    "status" "AnalyticsOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsIdentity_userId_key" ON "AnalyticsIdentity"("userId");
CREATE INDEX "AnalyticsIdentity_clientId_idx" ON "AnalyticsIdentity"("clientId");
CREATE INDEX "AnalyticsIdentity_revokedAt_idx" ON "AnalyticsIdentity"("revokedAt");
CREATE UNIQUE INDEX "AnalyticsEventOutbox_deduplicationKey_key" ON "AnalyticsEventOutbox"("deduplicationKey");
CREATE INDEX "AnalyticsEventOutbox_status_nextAttemptAt_idx" ON "AnalyticsEventOutbox"("status", "nextAttemptAt");
CREATE INDEX "AnalyticsEventOutbox_analyticsIdentityId_idx" ON "AnalyticsEventOutbox"("analyticsIdentityId");

ALTER TABLE "AnalyticsIdentity" ADD CONSTRAINT "AnalyticsIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEventOutbox" ADD CONSTRAINT "AnalyticsEventOutbox_analyticsIdentityId_fkey" FOREIGN KEY ("analyticsIdentityId") REFERENCES "AnalyticsIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
