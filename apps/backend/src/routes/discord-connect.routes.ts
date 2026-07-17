import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashDiscordLinkToken } from "../lib/discord-link.js";

const TokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
const ClaimSchema = TokenSchema.extend({
  targetGroupId: z.string().cuid().optional(),
  newGroupName: z.string().trim().min(1).max(100).optional()
});

class DiscordConnectError extends Error {
  public constructor(
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(code);
  }
}

export async function discordConnectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/discord-connect/preview", async (req, reply) => {
    const body = TokenSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "INVALID_LINK_TOKEN" });
    const { sub } = req.user as { sub: string };
    const link = await prisma.discordLinkToken.findUnique({
      where: { codeHash: hashDiscordLinkToken(body.data.token) },
      include: { group: { select: { id: true, name: true, discordGuildId: true } } }
    });
    if (!link || link.expiresAt <= new Date() || !link.group.discordGuildId) {
      return reply.status(404).send({ error: "INVALID_OR_EXPIRED_LINK_TOKEN" });
    }

    const activeWebMemberships = await prisma.groupMembership.count({
      where: { groupId: link.groupId, userId: { not: null }, leftAt: null }
    });
    if (activeWebMemberships > 0) {
      return reply.status(409).send({ error: "DISCORD_SERVER_ALREADY_LINKED" });
    }

    const [installation, groups, sessionCount] = await Promise.all([
      prisma.discordInstallation.findUnique({
        where: { discordGuildId: link.group.discordGuildId },
        select: { guildName: true }
      }),
      prisma.group.findMany({
        where: {
          discordGuildId: null,
          memberships: {
            some: { userId: sub, leftAt: null, role: "GM" }
          }
        },
        select: { id: true, name: true, description: true },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.session.count({ where: { campaign: { groupId: link.groupId } } })
    ]);

    return reply.send({
      guildName: installation?.guildName ?? link.group.name,
      expiresAt: link.expiresAt,
      existingSessions: sessionCount,
      groups
    });
  });

  app.post("/discord-connect/claim", async (req, reply) => {
    const body = ClaimSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "INVALID_LINK_REQUEST" });
    const { sub } = req.user as { sub: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const link = await tx.discordLinkToken.findUnique({
          where: { codeHash: hashDiscordLinkToken(body.data.token) },
          include: { group: { include: { settings: true } } }
        });
        if (!link || link.expiresAt <= new Date() || !link.group.discordGuildId) {
          throw new DiscordConnectError("INVALID_OR_EXPIRED_LINK_TOKEN", 404);
        }

        const consumed = await tx.discordLinkToken.deleteMany({
          where: { id: link.id, expiresAt: { gt: new Date() } }
        });
        if (consumed.count !== 1) {
          throw new DiscordConnectError("INVALID_OR_EXPIRED_LINK_TOKEN", 404);
        }

        const source = link.group;
        const activeWebMemberships = await tx.groupMembership.count({
          where: { groupId: source.id, userId: { not: null }, leftAt: null }
        });
        if (activeWebMemberships > 0) {
          throw new DiscordConnectError("DISCORD_SERVER_ALREADY_LINKED", 409);
        }

        const guildId = source.discordGuildId!;
        const installation = await tx.discordInstallation.findUnique({
          where: { discordGuildId: guildId },
          select: { guildName: true }
        });
        const guildName = installation?.guildName ?? source.name;
        const mergedSessions = await tx.session.count({
          where: { campaign: { groupId: source.id } }
        });

        if (!body.data.targetGroupId) {
          const connected = await tx.group.update({
            where: { id: source.id },
            data: {
              name: body.data.newGroupName ?? guildName,
              memberships: { create: { userId: sub, role: "GM" } }
            }
          });
          return { groupId: connected.id, groupName: connected.name, guildName, mergedSessions };
        }

        const targetMembership = await tx.groupMembership.findFirst({
          where: {
            groupId: body.data.targetGroupId,
            userId: sub,
            leftAt: null,
            role: "GM",
            group: { discordGuildId: null }
          },
          include: { group: { include: { settings: true } } }
        });
        if (!targetMembership) {
          throw new DiscordConnectError("TARGET_GROUP_NOT_AVAILABLE", 403);
        }
        const target = targetMembership.group;

        await tx.campaign.updateMany({
          where: { groupId: source.id },
          data: { groupId: target.id }
        });
        await tx.groupMembership.updateMany({
          where: { groupId: source.id },
          data: { groupId: target.id }
        });

        if (source.settings && target.settings) {
          if (!target.settings.postSummaryChannelId && source.settings.postSummaryChannelId) {
            await tx.groupSettings.update({
              where: { groupId: target.id },
              data: { postSummaryChannelId: source.settings.postSummaryChannelId }
            });
          }
          await tx.groupSettings.delete({ where: { groupId: source.id } });
        } else if (source.settings) {
          await tx.groupSettings.update({
            where: { groupId: source.id },
            data: { groupId: target.id }
          });
        }

        await tx.group.update({
          where: { id: source.id },
          data: { discordGuildId: null }
        });
        const connected = await tx.group.update({
          where: { id: target.id },
          data: { discordGuildId: guildId }
        });
        await tx.group.delete({ where: { id: source.id } });

        return { groupId: connected.id, groupName: connected.name, guildName, mergedSessions };
      });

      return reply.send(result);
    } catch (error) {
      if (error instanceof DiscordConnectError) {
        return reply.status(error.statusCode).send({ error: error.code });
      }
      throw error;
    }
  });
}
