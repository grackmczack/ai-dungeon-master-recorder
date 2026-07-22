import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const CreateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).optional(),
  setting: z.string().trim().max(200).optional()
});

const campaignListInclude = {
  _count: { select: { sessions: true, memberships: true } },
  sessions: {
    orderBy: { startedAt: "asc" as const },
    take: 1,
    select: { startedAt: true }
  },
  bindings: {
    orderBy: [{ isActive: "desc" as const }, { createdAt: "asc" as const }],
    include: {
      installation: {
        select: {
          id: true,
          discordGuildId: true,
          guildName: true,
          isActive: true,
          lastSeenAt: true
        }
      }
    }
  }
};

async function listCampaignsForUser(userId: string) {
  const memberships = await prisma.campaignMembership.findMany({
    where: { userId, leftAt: null },
    orderBy: { campaign: { updatedAt: "desc" } },
    include: { campaign: { include: campaignListInclude } }
  });

  return memberships.map(({ campaign, role }) => ({
    ...campaign,
    role,
    firstSessionAt: campaign.sessions[0]?.startedAt ?? null,
    sessions: undefined
  }));
}

async function getCampaignForUser(campaignId: string, userId: string) {
  const membership = await prisma.campaignMembership.findFirst({
    where: { campaignId, userId, leftAt: null }
  });
  if (!membership) return null;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      memberships: {
        include: { user: { select: { id: true, displayName: true, email: true } } },
        orderBy: { joinedAt: "asc" }
      },
      bindings: {
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        include: {
          installation: {
            select: {
              id: true,
              discordGuildId: true,
              guildName: true,
              isActive: true,
              lastSeenAt: true
            }
          }
        }
      },
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          sessionNumber: true,
          title: true,
          sessionImageUrl: true,
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
      },
      _count: { select: { sessions: true, memberships: true } }
    }
  });

  return campaign ? { ...campaign, role: membership.role } : null;
}

export async function groupsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/campaigns", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    return reply.send(await listCampaignsForUser(sub));
  });

  app.post("/campaigns", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const body = CreateCampaignSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const campaign = await prisma.campaign.create({
      data: {
        ...body.data,
        memberships: { create: { userId: sub, role: "GM" } },
        settings: { create: {} }
      },
      include: campaignListInclude
    });
    return reply.status(201).send({
      ...campaign,
      role: "GM",
      firstSessionAt: null,
      sessions: undefined
    });
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const campaign = await getCampaignForUser(id, sub);
    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });
    return reply.send(campaign);
  });

  // Übergangs-Aliasse für alte Clients. Sichtbare Links werden im Frontend
  // auf /kampagnen umgeleitet; die API-Aliasse können nach einer Release-Phase entfallen.
  app.get("/groups", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    return reply.send(await listCampaignsForUser(sub));
  });

  app.get("/groups/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const campaign = await getCampaignForUser(id, sub);
    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });
    const primaryBinding = campaign.bindings[0];
    return reply.send({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      role: campaign.role,
      memberships: campaign.memberships,
      campaigns: [campaign],
      discordGuildId: primaryBinding?.installation.discordGuildId ?? null,
      discordGuildName: primaryBinding?.installation.guildName ?? null,
      discordBotActive: primaryBinding?.installation.isActive ?? false
    });
  });
}
