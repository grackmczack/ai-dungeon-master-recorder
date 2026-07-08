/**
 * Mitgliederverwaltung mit Historie, Pause-Funktion und Rollen
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["GM", "PLAYER", "OBSERVER"]).default("PLAYER"),
  characterName: z.string().optional(),
  notes: z.string().optional()
});

const UpdateMemberSchema = z.object({
  role: z.enum(["GM", "PLAYER", "OBSERVER"]).optional(),
  characterName: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function membersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  // GET /groups/:groupId/members — alle Mitglieder inkl. Historie
  app.get("/groups/:groupId/members", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, leftAt: null }
    });
    if (!myMembership) return reply.status(403).send({ error: "Not a member" });

    // Alle Mitglieder inkl. ehemaliger (leftAt != null)
    const members = await prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { joinedAt: "asc" }
    });

    return reply.send(members);
  });

  // POST /groups/:groupId/members — Mitglied einladen
  app.post("/groups/:groupId/members", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { sub } = req.user as { sub: string };
    const body = InviteSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    // Nur GM darf einladen
    const myMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can invite members" });

    const targetUser = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!targetUser) return reply.status(404).send({ error: "User not found. They need to register first." });

    // Bereits aktives Mitglied?
    const existing = await prisma.groupMembership.findFirst({
      where: { groupId, userId: targetUser.id, leftAt: null }
    });
    if (existing) return reply.status(409).send({ error: "Already an active member" });

    // Ehemaliges Mitglied wieder aufnehmen (leftAt auf null setzen)
    const former = await prisma.groupMembership.findFirst({
      where: { groupId, userId: targetUser.id }
    });

    if (former) {
      const rejoined = await prisma.groupMembership.update({
        where: { id: former.id },
        data: {
          leftAt: null,
          isPaused: false,
          pausedAt: null,
          role: body.data.role,
          characterName: body.data.characterName,
          notes: body.data.notes,
          joinedAt: new Date() // Neuer Beitrittszeitpunkt
        },
        include: { user: { select: { id: true, email: true, displayName: true } } }
      });
      return reply.status(200).send({ ...rejoined, _rejoined: true });
    }

    const membership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: targetUser.id,
        role: body.data.role,
        characterName: body.data.characterName,
        notes: body.data.notes
      },
      include: { user: { select: { id: true, email: true, displayName: true } } }
    });

    return reply.status(201).send(membership);
  });

  // PATCH /groups/:groupId/members/:memberId — Mitglied bearbeiten (Rolle, Charakter, Notizen)
  app.patch("/groups/:groupId/members/:memberId", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };
    const body = UpdateMemberSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const myMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can edit members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: body.data,
      include: { user: { select: { id: true, email: true, displayName: true } } }
    });

    return reply.send(updated);
  });

  // POST /groups/:groupId/members/:memberId/pause — Mitglied pausieren
  app.post("/groups/:groupId/members/:memberId/pause", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };
    const { note } = req.body as { note?: string };

    const myMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can pause members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { isPaused: true, pausedAt: new Date(), pauseNote: note ?? null }
    });

    return reply.send(updated);
  });

  // POST /groups/:groupId/members/:memberId/resume — Pause aufheben
  app.post("/groups/:groupId/members/:memberId/resume", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can resume members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { isPaused: false, pausedAt: null, pauseNote: null }
    });

    return reply.send(updated);
  });

  // DELETE /groups/:groupId/members/:memberId — Mitglied entfernen (leftAt setzen, kein DELETE)
  app.delete("/groups/:groupId/members/:memberId", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can remove members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { leftAt: new Date(), isPaused: false }
    });

    return reply.send({ removed: true, id: updated.id, leftAt: updated.leftAt });
  });
}
