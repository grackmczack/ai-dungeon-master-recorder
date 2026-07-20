import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ANALYTICS_POLICY_VERSION,
  grantAnalyticsConsent,
  revokeAnalyticsConsent
} from "../lib/analytics.js";

export const AnalyticsConsentSchema = z.object({
  clientId: z.string().uuid(),
  revocationToken: z.string().regex(/^[a-f0-9]{64}$/),
  policyVersion: z.literal(ANALYTICS_POLICY_VERSION),
  source: z.enum(["BANNER", "SETTINGS"])
});

const RevokeConsentSchema = AnalyticsConsentSchema.pick({
  clientId: true,
  revocationToken: true
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
