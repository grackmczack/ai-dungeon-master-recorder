import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ANALYTICS_POLICY_VERSION,
  ANALYTICS_CLIENT_ID_PATTERN,
  LEGACY_ANALYTICS_CLIENT_ID_PATTERN,
  grantAnalyticsConsent,
  revokeAnalyticsConsent
} from "../lib/analytics.js";

export const AnalyticsConsentSchema = z.object({
  clientId: z.string().regex(ANALYTICS_CLIENT_ID_PATTERN),
  revocationToken: z.string().regex(/^[a-f0-9]{64}$/),
  policyVersion: z.literal(ANALYTICS_POLICY_VERSION),
  source: z.enum(["BANNER", "SETTINGS"])
});

const RevokeConsentSchema = z.object({
  clientId: z
    .string()
    .refine(
      (value) =>
        ANALYTICS_CLIENT_ID_PATTERN.test(value) || LEGACY_ANALYTICS_CLIENT_ID_PATTERN.test(value)
    ),
  revocationToken: z.string().regex(/^[a-f0-9]{64}$/)
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.post("/analytics/consent", { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = AnalyticsConsentSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "INVALID_ANALYTICS_CONSENT" });
    const { sub } = req.user as { sub: string };
    await grantAnalyticsConsent(sub, body.data);
    return reply.status(204).send();
  });

  app.post("/analytics/consent/revoke", async (req, reply) => {
    const body = RevokeConsentSchema.safeParse(req.body);
    if (body.success) {
      await revokeAnalyticsConsent(body.data.clientId, body.data.revocationToken);
    }
    return reply.status(204).send();
  });
}
