import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  // PUT /campaigns/:id/context
  app.put("/campaigns/:id/context", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { campaignContext } = req.body as { campaignContext: string };

    // Prüfen ob User Mitglied der Gruppe ist
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const updated = await prisma.campaign.update({
      where: { id },
      data: { campaignContext, updatedAt: new Date() }
    });

    return reply.send({ updated: true, id: updated.id });
  });

  // PATCH /campaigns/:id — name, description, setting, isActive
  app.patch("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = req.body as { name?: string; description?: string; setting?: string; isActive?: boolean };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { group: { include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Only GMs can edit" });

    const updated = await prisma.campaign.update({ where: { id }, data: body });
    return reply.send(updated);
  });
}
