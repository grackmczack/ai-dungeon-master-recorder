import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const DiscordId = z.string().regex(/^\d{17,20}$/);
const UpdateBindingSchema = z.object({
  voiceChannelId: DiscordId.optional().nullable(),
  voiceChannelName: z.string().trim().min(1).max(100).optional().nullable(),
  summaryChannelId: DiscordId.optional().nullable(),
  summaryChannelName: z.string().trim().min(1).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional()
});
const CreateBindingSchema = z.object({ discordInstallationId: z.string().cuid() });

async function requireCampaignGm(campaignId: string, userId: string) {
  return prisma.campaignMembership.findFirst({
    where: { campaignId, userId, role: "GM", leftAt: null }
  });
}

export async function campaignBindingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/discord-installations", async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const installations = await prisma.discordInstallation.findMany({
      where: {
        bindings: {
          some: {
            campaign: {
              memberships: { some: { userId: sub, role: "GM", leftAt: null } }
            }
          }
        }
      },
      select: {
        id: true,
        discordGuildId: true,
        guildName: true,
        isActive: true,
        lastSeenAt: true
      },
      orderBy: [{ isActive: "desc" }, { guildName: "asc" }]
    });
    return reply.send(installations);
  });

  app.post("/campaigns/:campaignId/discord-bindings", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };
    const body = CreateBindingSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    if (!(await requireCampaignGm(campaignId, sub))) {
      return reply.status(403).send({ error: "Only GMs can add Discord bindings" });
    }
    const installation = await prisma.discordInstallation.findFirst({
      where: {
        id: body.data.discordInstallationId,
        bindings: {
          some: {
            campaign: {
              memberships: { some: { userId: sub, role: "GM", leftAt: null } }
            }
          }
        }
      }
    });
    if (!installation) {
      return reply.status(404).send({ error: "Discord installation not available" });
    }
    const existing = await prisma.campaignDiscordBinding.findFirst({
      where: { campaignId, discordInstallationId: installation.id },
      include: { installation: true }
    });
    if (existing) return reply.send(existing);

    const binding = await prisma.campaignDiscordBinding.create({
      data: {
        campaignId,
        discordInstallationId: installation.id,
        isActive: false,
        isDefault: false
      },
      include: { installation: true }
    });
    return reply.status(201).send(binding);
  });

  app.patch("/campaigns/:campaignId/discord-bindings/:bindingId", async (req, reply) => {
    const { campaignId, bindingId } = req.params as { campaignId: string; bindingId: string };
    const { sub } = req.user as { sub: string };
    const body = UpdateBindingSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    if (!(await requireCampaignGm(campaignId, sub))) {
      return reply.status(403).send({ error: "Only GMs can change Discord bindings" });
    }

    const binding = await prisma.campaignDiscordBinding.findFirst({
      where: { id: bindingId, campaignId },
      include: { installation: true }
    });
    if (!binding) return reply.status(404).send({ error: "Binding not found" });

    const nextVoiceChannelId =
      body.data.voiceChannelId === undefined ? binding.voiceChannelId : body.data.voiceChannelId;
    if (nextVoiceChannelId && (body.data.isActive ?? binding.isActive)) {
      const conflict = await prisma.campaignDiscordBinding.findFirst({
        where: {
          id: { not: binding.id },
          discordInstallationId: binding.discordInstallationId,
          voiceChannelId: nextVoiceChannelId,
          isActive: true
        }
      });
      if (conflict) {
        return reply.status(409).send({ error: "VOICE_CHANNEL_ALREADY_BOUND" });
      }
    }

    if (body.data.isDefault) {
      await prisma.campaignDiscordBinding.updateMany({
        where: {
          discordInstallationId: binding.discordInstallationId,
          id: { not: binding.id },
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    const updated = await prisma.campaignDiscordBinding.update({
      where: { id: binding.id },
      data: body.data,
      include: { installation: true }
    });
    return reply.send(updated);
  });

  app.delete("/campaigns/:campaignId/discord-bindings/:bindingId", async (req, reply) => {
    const { campaignId, bindingId } = req.params as { campaignId: string; bindingId: string };
    const { sub } = req.user as { sub: string };
    if (!(await requireCampaignGm(campaignId, sub))) {
      return reply.status(403).send({ error: "Only GMs can remove Discord bindings" });
    }
    const binding = await prisma.campaignDiscordBinding.findFirst({
      where: { id: bindingId, campaignId }
    });
    if (!binding) return reply.status(404).send({ error: "Binding not found" });
    await prisma.campaignDiscordBinding.delete({ where: { id: binding.id } });
    return reply.send({ removed: true, id: binding.id });
  });
}
