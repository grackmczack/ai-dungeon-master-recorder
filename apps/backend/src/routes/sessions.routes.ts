import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function sessionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  // GET /sessions/:id — full session detail with transcript + summary
  app.get("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: { include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } } },
        recordings: true,
        transcript: true,
        summary: true,
        speakerMaps: true
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    return reply.send(session);
  });

  // PUT /sessions/:id/speakers — map Discord user IDs to character names
  app.put("/sessions/:id/speakers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { speakers } = req.body as { speakers: Array<{ discordUserId: string; discordName: string; characterName?: string; playerName?: string }> };

    const session = await prisma.session.findUnique({
      where: { id },
      include: { campaign: { include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } } } }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    // Upsert all speaker maps
    await Promise.all(speakers.map(s =>
      prisma.speakerMap.upsert({
        where: { sessionId_discordUserId: { sessionId: id, discordUserId: s.discordUserId } },
        update: { characterName: s.characterName, playerName: s.playerName, discordName: s.discordName },
        create: { sessionId: id, ...s }
      })
    ));

    return reply.send({ updated: speakers.length });
  });
}
