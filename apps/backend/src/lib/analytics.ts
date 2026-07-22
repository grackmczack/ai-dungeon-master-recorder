import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export const ANALYTICS_POLICY_VERSION = "2026-07-20";
export const ANALYTICS_CLIENT_ID_PATTERN = /^[1-9]\d{0,9}\.[1-9]\d{0,9}$/;
export const LEGACY_ANALYTICS_CLIENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GA_MEASUREMENT_PROTOCOL_ENDPOINT = "https://region1.google-analytics.com/mp/collect";

export const SERVER_ANALYTICS_EVENTS = [
  "email_verified",
  "account_approved",
  "discord_connection_claimed",
  "campaign_channel_configured",
  "recording_started",
  "first_recording_started",
  "recording_completed",
  "session_processing_failed",
  "first_session_completed"
] as const;

export type ServerAnalyticsEvent = (typeof SERVER_ANALYTICS_EVENTS)[number];
type ServerAnalyticsParameters = Partial<{
  journey_stage: "registration" | "approval" | "setup" | "activation";
  feature_name: "registration" | "discord" | "campaign" | "recording";
  method: "web" | "discord";
  result: "success";
}>;

const ALLOWED_PARAMETER_KEYS = new Set(["journey_stage", "feature_name", "method", "result"]);

let processing = false;
let lastCleanupAt = 0;

export function hashAnalyticsRevocationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeParameters(parameters: ServerAnalyticsParameters): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(parameters).filter(([key, value]) => {
      return ALLOWED_PARAMETER_KEYS.has(key) && typeof value === "string";
    })
  );
}

export async function grantAnalyticsConsent(
  userId: string,
  input: {
    clientId: string;
    revocationToken: string;
    policyVersion: string;
    source: "BANNER" | "SETTINGS";
  }
) {
  return prisma.analyticsIdentity.upsert({
    where: { userId },
    update: {
      clientId: input.clientId,
      revocationTokenHash: hashAnalyticsRevocationToken(input.revocationToken),
      policyVersion: input.policyVersion,
      source: input.source,
      grantedAt: new Date(),
      revokedAt: null
    },
    create: {
      userId,
      clientId: input.clientId,
      revocationTokenHash: hashAnalyticsRevocationToken(input.revocationToken),
      policyVersion: input.policyVersion,
      source: input.source
    }
  });
}

export async function revokeAnalyticsConsent(clientId: string, revocationToken: string) {
  const identities = await prisma.analyticsIdentity.findMany({
    where: {
      clientId,
      revocationTokenHash: hashAnalyticsRevocationToken(revocationToken),
      revokedAt: null
    },
    select: { id: true }
  });
  if (identities.length === 0) return 0;

  const ids = identities.map((identity) => identity.id);
  await prisma.$transaction([
    prisma.analyticsIdentity.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date() }
    }),
    prisma.analyticsEventOutbox.updateMany({
      where: { analyticsIdentityId: { in: ids }, status: "PENDING" },
      data: { status: "FAILED", lastErrorCode: "consent_revoked" }
    })
  ]);
  return ids.length;
}

export async function enqueueAnalyticsEvent(
  userId: string,
  eventName: ServerAnalyticsEvent,
  deduplicationKey: string,
  parameters: ServerAnalyticsParameters
): Promise<boolean> {
  const identity = await prisma.analyticsIdentity.findFirst({
    where: {
      userId,
      revokedAt: null,
      policyVersion: ANALYTICS_POLICY_VERSION
    },
    select: { id: true }
  });
  if (!identity) return false;

  try {
    await prisma.analyticsEventOutbox.create({
      data: {
        analyticsIdentityId: identity.id,
        eventName,
        parameters: safeParameters(parameters),
        deduplicationKey
      }
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}

export async function enqueueCampaignAnalyticsEvent(
  campaignId: string,
  eventName: ServerAnalyticsEvent,
  deduplicationKey: string,
  parameters: ServerAnalyticsParameters
): Promise<number> {
  const memberships = await prisma.campaignMembership.findMany({
    where: { campaignId, role: "GM", leftAt: null, userId: { not: null } },
    select: { userId: true }
  });
  const userIds = [...new Set(memberships.flatMap((membership) => membership.userId ?? []))];
  const results = await Promise.all(
    userIds.map((userId) =>
      enqueueAnalyticsEvent(userId, eventName, `${deduplicationKey}:${userId}`, parameters)
    )
  );
  return results.filter(Boolean).length;
}

function deliveryConfig() {
  const measurementId = process.env.GA_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA_API_SECRET?.trim();
  if (!measurementId || !apiSecret) return null;
  return { measurementId, apiSecret };
}

async function deliverPendingAnalyticsEvents(log: FastifyBaseLogger): Promise<void> {
  if (processing) return;
  const config = deliveryConfig();
  if (!config) return;
  processing = true;
  try {
    if (Date.now() - lastCleanupAt > 24 * 60 * 60_000) {
      lastCleanupAt = Date.now();
      await prisma.analyticsEventOutbox.deleteMany({
        where: {
          OR: [
            { status: "SENT", sentAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60_000) } },
            { status: "FAILED", updatedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60_000) } }
          ]
        }
      });
    }
    const events = await prisma.analyticsEventOutbox.findMany({
      where: {
        status: "PENDING",
        nextAttemptAt: { lte: new Date() },
        analyticsIdentity: {
          revokedAt: null,
          policyVersion: ANALYTICS_POLICY_VERSION
        }
      },
      include: { analyticsIdentity: { select: { clientId: true } } },
      orderBy: { createdAt: "asc" },
      take: 20
    });

    for (const event of events) {
      let errorCode: string | null = null;
      try {
        const url = new URL(GA_MEASUREMENT_PROTOCOL_ENDPOINT);
        url.searchParams.set("measurement_id", config.measurementId);
        url.searchParams.set("api_secret", config.apiSecret);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "DnD-Recorder-Analytics-Outbox/1.0"
          },
          body: JSON.stringify({
            client_id: event.analyticsIdentity.clientId,
            non_personalized_ads: true,
            consent: {
              ad_user_data: "DENIED",
              ad_personalization: "DENIED"
            },
            events: [{ name: event.eventName, params: event.parameters }]
          }),
          signal: AbortSignal.timeout(5_000)
        });
        if (!response.ok) errorCode = `http_${response.status}`;
      } catch (error) {
        errorCode =
          error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error";
      }

      if (!errorCode) {
        await prisma.analyticsEventOutbox.update({
          where: { id: event.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastErrorCode: null
          }
        });
        continue;
      }

      const attempts = event.attempts + 1;
      await prisma.analyticsEventOutbox.update({
        where: { id: event.id },
        data: {
          status: attempts >= 8 ? "FAILED" : "PENDING",
          attempts,
          lastErrorCode: errorCode,
          nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 30_000))
        }
      });
      log.warn(
        { analyticsEventId: event.id, errorCode, attempts },
        "Analytics lifecycle delivery failed"
      );
    }
  } finally {
    processing = false;
  }
}

export function startAnalyticsOutboxProcessor(log: FastifyBaseLogger): () => void {
  const timer = setInterval(() => {
    void deliverPendingAnalyticsEvents(log).catch((error: unknown) => {
      log.error({ err: error }, "Analytics outbox processor failed");
    });
  }, 30_000);
  timer.unref();
  void deliverPendingAnalyticsEvents(log);
  return () => clearInterval(timer);
}
