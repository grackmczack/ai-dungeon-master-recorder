import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashDiscordLinkToken } from "../lib/discord-link.js";

const TokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
const ClaimSchema = TokenSchema.extend({
  targetCampaignId: z.string().cuid().optional(),
  // Übergang für bereits geöffnete Links aus der vorherigen UI.
  targetGroupId: z.string().cuid().optional(),
  newCampaignName: z.string().trim().min(1).max(120).optional(),
  newGroupName: z.string().trim().min(1).max(120).optional()
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
      include: {
        installation: {
          include: {
            bindings: {
              include: {
                campaign: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    _count: { select: { sessions: true } }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!link || link.expiresAt <= new Date()) {
      return reply.status(404).send({ error: "INVALID_OR_EXPIRED_LINK_TOKEN" });
    }

    const linkedMemberships = await prisma.campaignMembership.count({
      where: {
        userId: { not: null },
        leftAt: null,
        campaign: {
          bindings: { some: { discordInstallationId: link.discordInstallationId } }
        }
      }
    });
    if (linkedMemberships > 0) {
      return reply.status(409).send({ error: "DISCORD_SERVER_ALREADY_LINKED" });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        memberships: { some: { userId: sub, leftAt: null, role: "GM" } }
      },
      select: { id: true, name: true, description: true },
      orderBy: { updatedAt: "desc" }
    });
    const existingSessions = link.installation.bindings.reduce(
      (sum, binding) => sum + binding.campaign._count.sessions,
      0
    );

    return reply.send({
      guildName: link.installation.guildName,
      expiresAt: link.expiresAt,
      existingSessions,
      campaigns,
      // Übergangsname für alte Frontend-Builds.
      groups: campaigns
    });
  });

  app.post("/discord-connect/claim", async (req, reply) => {
    const body = ClaimSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "INVALID_LINK_REQUEST" });
    const { sub } = req.user as { sub: string };
    const targetCampaignId = body.data.targetCampaignId ?? body.data.targetGroupId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const link = await tx.discordLinkToken.findUnique({
          where: { codeHash: hashDiscordLinkToken(body.data.token) },
          include: {
            installation: {
              include: {
                bindings: { include: { campaign: { include: { settings: true } } } }
              }
            }
          }
        });
        if (!link || link.expiresAt <= new Date()) {
          throw new DiscordConnectError("INVALID_OR_EXPIRED_LINK_TOKEN", 404);
        }
        const consumed = await tx.discordLinkToken.deleteMany({
          where: { id: link.id, expiresAt: { gt: new Date() } }
        });
        if (consumed.count !== 1) {
          throw new DiscordConnectError("INVALID_OR_EXPIRED_LINK_TOKEN", 404);
        }

        const linkedMemberships = await tx.campaignMembership.count({
          where: {
            userId: { not: null },
            leftAt: null,
            campaign: {
              bindings: { some: { discordInstallationId: link.discordInstallationId } }
            }
          }
        });
        if (linkedMemberships > 0) {
          throw new DiscordConnectError("DISCORD_SERVER_ALREADY_LINKED", 409);
        }

        const sourceCampaignIds = [
          ...new Set(link.installation.bindings.map((binding) => binding.campaignId))
        ];
        const mergedSessions = await tx.session.count({
          where: { campaignId: { in: sourceCampaignIds } }
        });

        if (!targetCampaignId) {
          const source = link.installation.bindings[0]?.campaign;
          if (!source) throw new DiscordConnectError("NO_CAMPAIGN_FOR_SERVER", 409);
          const connected = await tx.campaign.update({
            where: { id: source.id },
            data: {
              name:
                body.data.newCampaignName ?? body.data.newGroupName ?? link.installation.guildName,
              memberships: { create: { userId: sub, role: "GM" } }
            }
          });
          return {
            campaignId: connected.id,
            campaignName: connected.name,
            guildName: link.installation.guildName,
            mergedSessions
          };
        }

        const targetMembership = await tx.campaignMembership.findFirst({
          where: { campaignId: targetCampaignId, userId: sub, leftAt: null, role: "GM" },
          include: { campaign: { include: { settings: true } } }
        });
        if (!targetMembership) {
          throw new DiscordConnectError("TARGET_CAMPAIGN_NOT_AVAILABLE", 403);
        }
        const target = targetMembership.campaign;

        await tx.session.updateMany({
          where: { campaignId: { in: sourceCampaignIds } },
          data: { campaignId: target.id }
        });
        await tx.campaignDiscordBinding.updateMany({
          where: { discordInstallationId: link.discordInstallationId },
          data: { campaignId: target.id }
        });

        const sourceSettings = link.installation.bindings
          .map((binding) => binding.campaign.settings)
          .find(Boolean);
        if (sourceSettings && target.settings && !target.settings.postSummaryChannelId) {
          await tx.campaignSettings.update({
            where: { campaignId: target.id },
            data: { postSummaryChannelId: sourceSettings.postSummaryChannelId }
          });
        }

        const deleteIds = sourceCampaignIds.filter((id) => id !== target.id);
        if (deleteIds.length > 0) {
          await tx.campaign.deleteMany({ where: { id: { in: deleteIds } } });
        }
        return {
          campaignId: target.id,
          campaignName: target.name,
          guildName: link.installation.guildName,
          mergedSessions
        };
      });

      return reply.send({
        ...result,
        // Übergang für alte Frontend-Builds.
        groupId: result.campaignId,
        groupName: result.campaignName
      });
    } catch (error) {
      if (error instanceof DiscordConnectError) {
        return reply.status(error.statusCode).send({ error: error.code });
      }
      throw error;
    }
  });
}
