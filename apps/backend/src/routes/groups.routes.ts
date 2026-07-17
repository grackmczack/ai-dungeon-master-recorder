import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2_000).optional()
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
    const guildIds = memberships.flatMap((membership) =>
      membership.group.discordGuildId ? [membership.group.discordGuildId] : []
    );
    const installations = await prisma.discordInstallation.findMany({
      where: { discordGuildId: { in: guildIds } },
      select: { discordGuildId: true, guildName: true, isActive: true }
    });
    const installationsByGuild = new Map(
      installations.map((installation) => [installation.discordGuildId, installation])
    );
    return reply.send(
      memberships.map((membership) => {
        const installation = membership.group.discordGuildId
          ? installationsByGuild.get(membership.group.discordGuildId)
          : null;
        return {
          ...membership.group,
          role: membership.role,
          discordGuildName: installation?.guildName ?? null,
          discordBotActive: installation?.isActive ?? false
        };
      })
    );
  });

  // POST /groups — create group
  app.post("/groups", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = CreateGroupSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

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
    const installation = group?.discordGuildId
      ? await prisma.discordInstallation.findUnique({
          where: { discordGuildId: group.discordGuildId },
          select: { guildName: true, isActive: true }
        })
      : null;
    return reply.send({
      ...group,
      discordGuildName: installation?.guildName ?? null,
      discordBotActive: installation?.isActive ?? false
    });
  });

  // POST /groups/:id/members — handled by members.routes.ts
}
