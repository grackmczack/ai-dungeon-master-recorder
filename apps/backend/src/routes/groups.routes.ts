import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const CreateGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discordGuildId: z
    .string()
    .regex(/^\d{17,20}$/)
    .optional()
});

export async function groupsRoutes(app: FastifyInstance) {
  // All routes require auth
  app.addHook("preHandler", app.authenticate);

  // GET /groups — list groups for current user
  app.get("/groups", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: sub, leftAt: null },
      include: {
        group: {
          include: {
            _count: { select: { campaigns: true, memberships: true } }
          }
        }
      }
    });
    return reply.send(memberships.map((m) => ({ ...m.group, role: m.role })));
  });

  // POST /groups — create group
  app.post("/groups", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = CreateGroupSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    if (body.data.discordGuildId) {
      const existing = await prisma.group.findUnique({
        where: { discordGuildId: body.data.discordGuildId },
        include: { memberships: { where: { userId: { not: null }, leftAt: null } } }
      });

      if (existing) {
        if (existing.memberships.length > 0) {
          return reply.status(409).send({ error: "Discord server already linked" });
        }

        const claimed = await prisma.group.update({
          where: { id: existing.id },
          data: {
            name: body.data.name,
            description: body.data.description,
            memberships: { create: { userId: sub, role: "GM" } }
          }
        });
        return reply.status(201).send(claimed);
      }
    }

    const group = await prisma.group.create({
      data: {
        ...body.data,
        memberships: { create: { userId: sub, role: "GM" } }
      }
    });
    return reply.status(201).send(group);
  });

  // GET /groups/:id
  app.get("/groups/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const membership = await prisma.groupMembership.findFirst({
      where: { groupId: id, userId: sub, leftAt: null }
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        discordGuildId: true,
        memberships: {
          include: { user: { select: { id: true, displayName: true, email: true } } },
          orderBy: { joinedAt: "asc" }
        },
        campaigns: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            description: true,
            setting: true,
            isActive: true,
            campaignContext: true,
            backgroundImageUrl: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { sessions: true } },
            sessions: {
              orderBy: { startedAt: "desc" },
              take: 10,
              select: {
                id: true,
                sessionNumber: true,
                title: true,
                status: true,
                startedAt: true,
                stoppedAt: true,
                speakerMaps: {
                  select: {
                    discordUserId: true,
                    discordName: true,
                    characterName: true
                  }
                }
              }
            }
          }
        }
      }
    });
    return reply.send(group);
  });

  // POST /groups/:id/members — handled by members.routes.ts
}
