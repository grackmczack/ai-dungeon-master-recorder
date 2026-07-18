/**
 * Interne API-Endpunkte für Bot und Transcriber.
 * Geschützt durch x-internal-token; Discord-User-IDs werden nur als
 * Session-Speaker-Snapshot gespeichert, nicht zur Kontoverfolgung.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  buildDiscordConnectUrl,
  createDiscordLinkToken,
  discordLinkExpiresAt,
  hashDiscordLinkToken
} from "../lib/discord-link.js";

const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;
if (process.env.NODE_ENV === "production" && !INTERNAL_TOKEN) {
  throw new Error("INTERNAL_TOKEN is required in production");
}

const DiscordIdSchema = z.string().regex(/^\d{17,20}$/);
const BindingIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const GuildInstallationSchema = z.object({ guildName: z.string().trim().min(1).max(100) });
const GuildInstallationsSchema = z.object({
  guilds: z
    .array(z.object({ guildId: DiscordIdSchema, guildName: z.string().trim().min(1).max(100) }))
    .max(10_000)
});
const DiscordConnectLinkSchema = z.object({
  guildId: DiscordIdSchema,
  guildName: z.string().trim().min(1).max(100)
});
const BindingSchema = z.object({
  guildName: z.string().trim().min(1).max(100),
  campaignId: z.string().cuid(),
  voiceChannelId: DiscordIdSchema,
  voiceChannelName: z.string().trim().min(1).max(100),
  summaryChannelId: DiscordIdSchema.nullable().optional(),
  summaryChannelName: z.string().trim().min(1).max(100).nullable().optional(),
  isDefault: z.boolean().optional()
});
const BindingStateSchema = z
  .object({ isActive: z.boolean().optional(), isDefault: z.boolean().optional() })
  .refine((value) => value.isActive !== undefined || value.isDefault !== undefined);
const SessionInputSchema = z.object({
  guildId: DiscordIdSchema,
  guildName: z.string().trim().min(1).max(100).optional(),
  campaignId: z.string().cuid().optional(),
  voiceChannelId: DiscordIdSchema,
  voiceChannelName: z.string().trim().min(1).max(100),
  textChannelId: DiscordIdSchema,
  filename: z.string().trim().min(1).max(255),
  filePath: z.string().max(2_000),
  durationSeconds: z.number().finite().nonnegative(),
  participants: z
    .array(
      z.object({
        discordUserId: DiscordIdSchema,
        discordName: z.string().trim().min(1).max(100),
        discordDisplayName: z.string().trim().min(1).max(100).optional()
      })
    )
    .max(100)
});

function checkToken(req: FastifyRequest, reply: FastifyReply) {
  const supplied = req.headers["x-internal-token"];
  const expected = INTERNAL_TOKEN ?? "development-only-internal-token";
  const valid =
    typeof supplied === "string" &&
    supplied.length === expected.length &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) {
    reply.status(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function syncInstallation(guildId: string, guildName: string) {
  return prisma.discordInstallation.upsert({
    where: { discordGuildId: guildId },
    update: { guildName, isActive: true, removedAt: null, lastSeenAt: new Date() },
    create: { discordGuildId: guildId, guildName, isActive: true }
  });
}

async function createDefaultCampaign(installation: { id: string; guildName: string }) {
  return prisma.campaign.create({
    data: {
      name: installation.guildName,
      description: "Automatisch vom Discord-Bot angelegt — bitte im Web-Panel ergänzen.",
      settings: { create: {} },
      bindings: {
        create: {
          discordInstallationId: installation.id,
          isActive: true,
          isDefault: true
        }
      }
    },
    include: { bindings: true }
  });
}

type ResolvedBinding = Awaited<ReturnType<typeof resolveBinding>>;

async function resolveBinding(input: {
  installationId: string;
  campaignId?: string | undefined;
  voiceChannelId?: string | undefined;
  voiceChannelName?: string | undefined;
}) {
  const bindings = await prisma.campaignDiscordBinding.findMany({
    where: {
      discordInstallationId: input.installationId,
      isActive: true,
      campaign: { isActive: true }
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { campaign: true }
  });

  const voiceBinding = input.voiceChannelId
    ? bindings.find((binding) => binding.voiceChannelId === input.voiceChannelId)
    : undefined;

  if (input.campaignId && voiceBinding && voiceBinding.campaignId !== input.campaignId) {
    return { error: "VOICE_CHANNEL_BOUND_TO_OTHER_CAMPAIGN" as const, choices: bindings };
  }

  const campaignIds = new Set(bindings.map((binding) => binding.campaignId));
  const selectedCampaignId =
    input.campaignId ??
    voiceBinding?.campaignId ??
    (campaignIds.size === 1 ? [...campaignIds][0] : undefined);
  let selected = selectedCampaignId
    ? (bindings.find(
        (binding) =>
          binding.campaignId === selectedCampaignId &&
          binding.voiceChannelId === input.voiceChannelId
      ) ??
      bindings.find(
        (binding) => binding.campaignId === selectedCampaignId && !binding.voiceChannelId
      ))
    : undefined;

  if (!selectedCampaignId) {
    return { error: "CAMPAIGN_SELECTION_REQUIRED" as const, choices: bindings };
  }

  // Eine eindeutige Kampagnenauswahl richtet einen bisher freien Voice-Channel
  // beim ersten /record automatisch ein. Das spart einen separaten Setup-Schritt.
  if (selected && !selected.voiceChannelId && input.voiceChannelId) {
    selected = await prisma.campaignDiscordBinding.update({
      where: { id: selected.id },
      data: {
        voiceChannelId: input.voiceChannelId,
        voiceChannelName: input.voiceChannelName ?? input.voiceChannelId
      },
      include: { campaign: true }
    });
  } else if (!selected && input.voiceChannelId) {
    const template = bindings.find((binding) => binding.campaignId === selectedCampaignId);
    if (!template) {
      return { error: "CAMPAIGN_SELECTION_REQUIRED" as const, choices: bindings };
    }
    selected = await prisma.campaignDiscordBinding.create({
      data: {
        campaignId: selectedCampaignId,
        discordInstallationId: input.installationId,
        voiceChannelId: input.voiceChannelId,
        voiceChannelName: input.voiceChannelName ?? input.voiceChannelId,
        summaryChannelId: template.summaryChannelId,
        summaryChannelName: template.summaryChannelName,
        isActive: true,
        isDefault: false
      },
      include: { campaign: true }
    });
  }

  selected ??= bindings.find((binding) => binding.campaignId === selectedCampaignId);
  if (!selected) return { error: "CAMPAIGN_SELECTION_REQUIRED" as const, choices: bindings };

  return { binding: selected, choices: bindings };
}

function bindingDto(binding: {
  id: string;
  campaignId: string;
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  summaryChannelId: string | null;
  summaryChannelName: string | null;
  isActive: boolean;
  isDefault: boolean;
  campaign: { name: string };
}) {
  return {
    bindingId: binding.id,
    campaignId: binding.campaignId,
    campaignName: binding.campaign.name,
    voiceChannelId: binding.voiceChannelId,
    voiceChannelName: binding.voiceChannelName,
    summaryChannelId: binding.summaryChannelId,
    summaryChannelName: binding.summaryChannelName,
    isActive: binding.isActive,
    isDefault: binding.isDefault
  };
}

export async function internalRoutes(app: FastifyInstance) {
  app.put("/internal/discord/installations", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const body = GuildInstallationsSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid Discord guild list" });

    const now = new Date();
    const guildIds = body.data.guilds.map((guild) => guild.guildId);
    await prisma.$transaction([
      ...body.data.guilds.map((guild) =>
        prisma.discordInstallation.upsert({
          where: { discordGuildId: guild.guildId },
          update: {
            guildName: guild.guildName,
            isActive: true,
            removedAt: null,
            lastSeenAt: now
          },
          create: {
            discordGuildId: guild.guildId,
            guildName: guild.guildName,
            isActive: true,
            lastSeenAt: now
          }
        })
      ),
      prisma.discordInstallation.updateMany({
        where: {
          isActive: true,
          ...(guildIds.length > 0 ? { discordGuildId: { notIn: guildIds } } : {})
        },
        data: { isActive: false, removedAt: now, lastSeenAt: now }
      }),
      prisma.discordLinkToken.deleteMany({
        where: {
          installation:
            guildIds.length > 0
              ? { discordGuildId: { notIn: guildIds } }
              : { discordGuildId: { not: "" } }
        }
      })
    ]);

    return reply.send({ activeInstallations: guildIds.length });
  });

  app.put("/internal/discord/installations/:guildId", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordIdSchema }).safeParse(req.params);
    const body = GuildInstallationSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: "Invalid Discord guild installation" });
    }
    const installation = await syncInstallation(params.data.guildId, body.data.guildName);
    return reply.send(installation);
  });

  app.delete("/internal/discord/installations/:guildId", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordIdSchema }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid Discord guild id" });
    const installation = await prisma.discordInstallation.findUnique({
      where: { discordGuildId: params.data.guildId }
    });
    if (installation) {
      const now = new Date();
      await prisma.$transaction([
        prisma.discordInstallation.update({
          where: { id: installation.id },
          data: { isActive: false, removedAt: now, lastSeenAt: now }
        }),
        prisma.discordLinkToken.deleteMany({ where: { discordInstallationId: installation.id } })
      ]);
    }
    return reply.status(204).send();
  });

  app.post("/internal/discord/connect-link", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const body = DiscordConnectLinkSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "INVALID_LINK_REQUEST" });
    const installation = await syncInstallation(body.data.guildId, body.data.guildName);
    let bindingCount = await prisma.campaignDiscordBinding.count({
      where: { discordInstallationId: installation.id }
    });
    if (bindingCount === 0) {
      await createDefaultCampaign(installation);
      bindingCount = 1;
    }

    const activeWebMemberships = await prisma.campaignMembership.count({
      where: {
        userId: { not: null },
        leftAt: null,
        campaign: { bindings: { some: { discordInstallationId: installation.id } } }
      }
    });
    if (activeWebMemberships > 0) {
      await prisma.discordLinkToken.deleteMany({
        where: { discordInstallationId: installation.id }
      });
      return reply.send({ linked: true, connectUrl: null, expiresAt: null, bindingCount });
    }

    const token = createDiscordLinkToken();
    const expiresAt = discordLinkExpiresAt();
    await prisma.discordLinkToken.upsert({
      where: { discordInstallationId: installation.id },
      update: { codeHash: hashDiscordLinkToken(token), expiresAt },
      create: {
        discordInstallationId: installation.id,
        codeHash: hashDiscordLinkToken(token),
        expiresAt
      }
    });
    return reply.send({
      linked: false,
      connectUrl: buildDiscordConnectUrl(process.env.APP_URL ?? "http://localhost:5173", token),
      expiresAt,
      bindingCount
    });
  });

  app.get("/internal/guild/:guildId/campaigns", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordIdSchema }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "INVALID_GUILD" });
    const installation = await prisma.discordInstallation.findUnique({
      where: { discordGuildId: params.data.guildId },
      include: {
        bindings: {
          include: { campaign: { select: { id: true, name: true, isActive: true } } },
          orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { createdAt: "asc" }]
        }
      }
    });
    return reply.send({
      guildId: params.data.guildId,
      guildName: installation?.guildName ?? params.data.guildId,
      campaigns: installation?.bindings.map(bindingDto) ?? []
    });
  });

  app.put("/internal/guild/:guildId/bindings", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordIdSchema }).safeParse(req.params);
    const body = BindingSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: "INVALID_BINDING" });
    }
    const installation = await syncInstallation(params.data.guildId, body.data.guildName);
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: body.data.campaignId,
        isActive: true,
        memberships: { some: { role: "GM", leftAt: null } }
      }
    });
    if (!campaign) return reply.status(404).send({ error: "CAMPAIGN_NOT_AVAILABLE" });

    const conflict = await prisma.campaignDiscordBinding.findFirst({
      where: {
        discordInstallationId: installation.id,
        voiceChannelId: body.data.voiceChannelId,
        campaignId: { not: campaign.id }
      }
    });
    if (conflict) return reply.status(409).send({ error: "VOICE_CHANNEL_ALREADY_BOUND" });

    const existing = await prisma.campaignDiscordBinding.findFirst({
      where: {
        discordInstallationId: installation.id,
        campaignId: campaign.id,
        OR: [{ voiceChannelId: body.data.voiceChannelId }, { voiceChannelId: null }]
      },
      orderBy: { isDefault: "desc" }
    });
    if (body.data.isDefault) {
      await prisma.campaignDiscordBinding.updateMany({
        where: { discordInstallationId: installation.id, isDefault: true },
        data: { isDefault: false }
      });
    }
    const data = {
      voiceChannelId: body.data.voiceChannelId,
      voiceChannelName: body.data.voiceChannelName,
      summaryChannelId: body.data.summaryChannelId ?? null,
      summaryChannelName: body.data.summaryChannelName ?? null,
      isActive: true,
      isDefault: body.data.isDefault ?? existing?.isDefault ?? false
    };
    const binding = existing
      ? await prisma.campaignDiscordBinding.update({
          where: { id: existing.id },
          data,
          include: { campaign: { select: { name: true } } }
        })
      : await prisma.campaignDiscordBinding.create({
          data: {
            campaignId: campaign.id,
            discordInstallationId: installation.id,
            ...data
          },
          include: { campaign: { select: { name: true } } }
        });
    return reply.send(bindingDto(binding));
  });

  app.patch("/internal/guild/:guildId/bindings/:bindingId", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z
      .object({ guildId: DiscordIdSchema, bindingId: BindingIdSchema })
      .safeParse(req.params);
    const body = BindingStateSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: "INVALID_BINDING_STATE" });
    }
    const binding = await prisma.campaignDiscordBinding.findFirst({
      where: {
        id: params.data.bindingId,
        installation: { discordGuildId: params.data.guildId }
      },
      include: { campaign: { select: { name: true } } }
    });
    if (!binding) return reply.status(404).send({ error: "BINDING_NOT_FOUND" });

    if (body.data.isDefault === true) {
      await prisma.campaignDiscordBinding.updateMany({
        where: {
          discordInstallationId: binding.discordInstallationId,
          isDefault: true,
          id: { not: binding.id }
        },
        data: { isDefault: false }
      });
    }
    const updated = await prisma.campaignDiscordBinding.update({
      where: { id: binding.id },
      data: {
        ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
        ...(body.data.isDefault !== undefined ? { isDefault: body.data.isDefault } : {})
      },
      include: { campaign: { select: { name: true } } }
    });
    return reply.send(bindingDto(updated));
  });

  app.post("/internal/sessions", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const parsed = SessionInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "INVALID_SESSION" });
    const body = parsed.data;

    const guildName = body.guildName ?? `Discord Server ${body.guildId}`;
    const installation = await syncInstallation(body.guildId, guildName);
    let resolution: ResolvedBinding;
    const existingBindingCount = await prisma.campaignDiscordBinding.count({
      where: { discordInstallationId: installation.id }
    });
    if (existingBindingCount === 0) {
      const campaign = await createDefaultCampaign(installation);
      resolution = await resolveBinding({
        installationId: installation.id,
        campaignId: campaign.id,
        voiceChannelId: body.voiceChannelId,
        voiceChannelName: body.voiceChannelName
      });
    } else {
      resolution = await resolveBinding({
        installationId: installation.id,
        campaignId: body.campaignId,
        voiceChannelId: body.voiceChannelId,
        voiceChannelName: body.voiceChannelName
      });
    }
    if (!("binding" in resolution) || !resolution.binding) {
      return reply.status(409).send({
        error: resolution.error,
        campaigns: resolution.choices.map(bindingDto)
      });
    }
    const binding = resolution.binding;
    const campaign = binding.campaign;
    const { session, recording } = await prisma.$transaction(async (tx) => {
      // Mehrere Discord-Server dürfen dieselbe Kampagne nutzen. Der Lock stellt
      // sicher, dass parallele Aufnahmen trotzdem eindeutige Sessionnummern erhalten.
      await tx.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        campaign.id
      );
      const latest = await tx.session.aggregate({
        where: { campaignId: campaign.id },
        _max: { sessionNumber: true }
      });
      const sessionNumber = (latest._max.sessionNumber ?? 0) + 1;
      const createdSession = await tx.session.create({
        data: {
          campaignId: campaign.id,
          discordGuildId: body.guildId,
          discordBindingId: binding.id,
          discordVoiceChannelId: body.voiceChannelId,
          discordTextChannelId: body.textChannelId,
          sessionNumber,
          status: "RECORDING"
        }
      });
      const createdRecording = await tx.recording.create({
        data: {
          sessionId: createdSession.id,
          filename: body.filename,
          filePath: body.filePath,
          durationSeconds: body.durationSeconds,
          format: body.filename.endsWith(".mp3") ? "mp3" : "wav"
        }
      });

      if (body.participants.length === 0) {
        return { session: createdSession, recording: createdRecording };
      }
      const memberships = await tx.campaignMembership.findMany({
        where: { campaignId: campaign.id, leftAt: null, isPaused: false }
      });
      const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();
      await tx.speakerMap.createMany({
        data: body.participants.map((participant) => {
          const membership =
            memberships.find(
              (entry) =>
                entry.discordName && norm(entry.discordName) === norm(participant.discordName)
            ) ??
            memberships.find(
              (entry) =>
                !!participant.discordDisplayName &&
                (norm(entry.discordName) === norm(participant.discordDisplayName) ||
                  norm(entry.discordDisplayName) === norm(participant.discordDisplayName))
            );
          return {
            sessionId: createdSession.id,
            discordUserId: participant.discordUserId,
            discordName: participant.discordName,
            characterName: membership?.characterName ?? null,
            playerName:
              membership?.discordDisplayName ??
              participant.discordDisplayName ??
              membership?.discordName ??
              null
          };
        }),
        skipDuplicates: true
      });
      return { session: createdSession, recording: createdRecording };
    });

    return reply.status(201).send({
      sessionId: session.id,
      recordingId: recording.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
      bindingId: binding.id,
      summaryChannelId: binding.summaryChannelId
    });
  });

  app.patch("/internal/sessions/:sessionId/recording-complete", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ sessionId: z.string().cuid() }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "INVALID_SESSION" });
    const updated = await prisma.session.updateMany({
      where: { id: params.data.sessionId, status: "RECORDING" },
      data: { status: "PROCESSING", stoppedAt: new Date() }
    });
    if (updated.count !== 1) {
      return reply.status(409).send({ error: "SESSION_NOT_RECORDING" });
    }
    return reply.send({ sessionId: params.data.sessionId, status: "PROCESSING" });
  });

  app.get("/internal/guild/:guildId/post-channel", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const { guildId } = req.params as { guildId: string };
    const { voiceChannelId, campaignId } = req.query as {
      voiceChannelId?: string;
      campaignId?: string;
    };
    const installation = await prisma.discordInstallation.findUnique({
      where: { discordGuildId: guildId }
    });
    if (!installation) return reply.send({ channelId: null });
    const resolution = await resolveBinding({
      installationId: installation.id,
      campaignId,
      voiceChannelId
    });
    return reply.send({
      channelId: "binding" in resolution ? (resolution.binding?.summaryChannelId ?? null) : null
    });
  });
}
