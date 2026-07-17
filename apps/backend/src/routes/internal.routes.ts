/**
 * Interne API-Endpunkte — nur für Bot + Transcriber (nicht öffentlich).
 * Geschützt durch x-internal-token Header.
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

const DiscordGuildIdSchema = z.string().regex(/^\d{17,20}$/);
const GuildInstallationSchema = z.object({ guildName: z.string().trim().min(1).max(100) });
const GuildInstallationsSchema = z.object({
  guilds: z
    .array(
      z.object({
        guildId: DiscordGuildIdSchema,
        guildName: z.string().trim().min(1).max(100)
      })
    )
    .max(10_000)
});
const PostChannelSchema = z.object({
  guildName: z.string().trim().min(1).max(100),
  channelId: z
    .string()
    .regex(/^\d{17,20}$/)
    .nullable()
});
const DiscordConnectLinkSchema = z.object({
  guildId: DiscordGuildIdSchema,
  guildName: z.string().trim().min(1).max(100)
});

async function syncInstallation(guildId: string, guildName: string) {
  return prisma.discordInstallation.upsert({
    where: { discordGuildId: guildId },
    update: {
      guildName,
      isActive: true,
      removedAt: null,
      lastSeenAt: new Date()
    },
    create: {
      discordGuildId: guildId,
      guildName,
      isActive: true
    }
  });
}

async function findOrCreateGuildGroup(guildId: string, guildName: string) {
  const group = await prisma.group.upsert({
    where: { discordGuildId: guildId },
    update: {},
    create: {
      name: guildName,
      discordGuildId: guildId,
      description: "Automatisch vom Discord-Bot angelegt"
    }
  });
  return group;
}

export async function internalRoutes(app: FastifyInstance) {
  // Guild-Lifecycle wird vom Bot bei Ready/Join/Leave synchronisiert.
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
          group:
            guildIds.length > 0
              ? { discordGuildId: { notIn: guildIds } }
              : { discordGuildId: { not: null } }
        }
      })
    ]);

    return reply.send({ activeInstallations: guildIds.length });
  });

  app.put("/internal/discord/installations/:guildId", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordGuildIdSchema }).safeParse(req.params);
    const body = GuildInstallationSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: "Invalid Discord guild installation" });
    }

    const installation = await syncInstallation(params.data.guildId, body.data.guildName);
    return reply.send({
      discordGuildId: installation.discordGuildId,
      guildName: installation.guildName,
      isActive: installation.isActive
    });
  });

  app.delete("/internal/discord/installations/:guildId", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordGuildIdSchema }).safeParse(req.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid Discord guild id" });

    const now = new Date();
    await prisma.$transaction([
      prisma.discordInstallation.updateMany({
        where: { discordGuildId: params.data.guildId },
        data: { isActive: false, removedAt: now, lastSeenAt: now }
      }),
      prisma.discordLinkToken.deleteMany({
        where: { group: { discordGuildId: params.data.guildId } }
      })
    ]);
    return reply.status(204).send();
  });

  // Gibt einem berechtigten Discord-Admin einen einmaligen Web-Link. Der Bot
  // kennt die Guild bereits; Discord-Userdaten werden nicht gespeichert.
  app.post("/internal/discord/connect-link", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const body = DiscordConnectLinkSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "INVALID_LINK_REQUEST" });

    const { guildId, guildName } = body.data;
    await syncInstallation(guildId, guildName);
    const group = await findOrCreateGuildGroup(guildId, guildName);
    const activeWebMemberships = await prisma.groupMembership.count({
      where: { groupId: group.id, userId: { not: null }, leftAt: null }
    });
    if (activeWebMemberships > 0) {
      await prisma.discordLinkToken.deleteMany({ where: { groupId: group.id } });
      return reply.send({ linked: true, connectUrl: null, expiresAt: null });
    }

    const token = createDiscordLinkToken();
    const expiresAt = discordLinkExpiresAt();
    await prisma.discordLinkToken.upsert({
      where: { groupId: group.id },
      update: { codeHash: hashDiscordLinkToken(token), expiresAt },
      create: { groupId: group.id, codeHash: hashDiscordLinkToken(token), expiresAt }
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    return reply.send({
      linked: false,
      connectUrl: buildDiscordConnectUrl(appUrl, token),
      expiresAt
    });
  });

  // POST /internal/sessions — Bot legt Session + Recording an
  app.post("/internal/sessions", async (req, reply) => {
    if (!checkToken(req, reply)) return;

    const { guildId, guildName, filename, filePath, durationSeconds, participants } = req.body as {
      guildId: string;
      guildName?: string;
      filename: string;
      filePath: string;
      durationSeconds: number;
      participants: Array<{
        discordUserId: string;
        discordName: string;
        discordDisplayName?: string;
      }>;
    };

    const resolvedGuildName = guildName ?? `Discord Server ${guildId}`;
    await syncInstallation(guildId, resolvedGuildName);
    const group = await findOrCreateGuildGroup(guildId, resolvedGuildName);

    // Aktive Campaign finden oder anlegen
    let campaign = await prisma.campaign.findFirst({
      where: { groupId: group.id, isActive: true },
      orderBy: { createdAt: "desc" }
    });
    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          groupId: group.id,
          name: "Kampagne 1",
          description: "Auto-erstellt — bitte im Web-Panel umbenennen!"
        }
      });
      console.log(`[INTERNAL] Kampagne ${campaign.id} für Gruppe ${group.id} angelegt`);
    }

    // Session-Nummer
    const count = await prisma.session.count({ where: { campaignId: campaign.id } });
    const sessionNumber = count + 1;

    // Session anlegen
    const session = await prisma.session.create({
      data: {
        campaignId: campaign.id,
        discordGuildId: guildId,
        sessionNumber,
        status: "PROCESSING",
        stoppedAt: new Date()
      }
    });

    // Recording anlegen
    const recording = await prisma.recording.create({
      data: {
        sessionId: session.id,
        filename,
        filePath,
        durationSeconds,
        format: filename.endsWith(".mp3") ? "mp3" : "wav"
      }
    });

    // SpeakerMaps anlegen — dabei charakter-/spieler-namen aus den aktiven
    // GroupMemberships vorbefüllen, damit der Transcriber nur noch das
    // diarizationLabel nachtragen muss (nicht die Character-Zuordnung).
    if (participants.length > 0) {
      // Aktive Mitglieder der Gruppe laden für das Matching.
      const memberships = await prisma.groupMembership.findMany({
        where: { groupId: group.id, leftAt: null }
      });

      const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

      const findMembership = (p: { discordName: string; discordDisplayName?: string }) => {
        // 1. exakt über discordName (Username, z.B. "veganrevlady")
        let m = memberships.find(
          (mm) => mm.discordName && norm(mm.discordName) === norm(p.discordName)
        );
        // 2. Fallback: über discordDisplayName gegen membership.discordName ODER discordDisplayName
        if (!m && p.discordDisplayName) {
          m = memberships.find(
            (mm) =>
              (mm.discordName && norm(mm.discordName) === norm(p.discordDisplayName)) ||
              (mm.discordDisplayName && norm(mm.discordDisplayName) === norm(p.discordDisplayName))
          );
        }
        return m ?? null;
      };

      await prisma.speakerMap.createMany({
        data: participants.map((p) => {
          const m = findMembership(p);
          return {
            sessionId: session.id,
            discordUserId: p.discordUserId,
            discordName: p.discordName,
            characterName: m?.characterName ?? null,
            playerName: m?.discordDisplayName ?? p.discordDisplayName ?? m?.discordName ?? null
          };
        }),
        skipDuplicates: true
      });
    }

    console.log(
      `[INTERNAL] Session ${session.id} (#${sessionNumber}) + Recording ${recording.id} angelegt`
    );
    return reply.status(201).send({ sessionId: session.id, recordingId: recording.id });
  });

  // GET /internal/guild/:guildId/post-channel
  app.get("/internal/guild/:guildId/post-channel", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const { guildId } = req.params as { guildId: string };
    const group = await prisma.group.findFirst({
      where: { discordGuildId: guildId },
      include: { settings: true }
    });
    return reply.send({ channelId: group?.settings?.postSummaryChannelId ?? null });
  });

  app.put("/internal/guild/:guildId/post-channel", async (req, reply) => {
    if (!checkToken(req, reply)) return;
    const params = z.object({ guildId: DiscordGuildIdSchema }).safeParse(req.params);
    const body = PostChannelSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: "Invalid Discord summary channel" });
    }

    await syncInstallation(params.data.guildId, body.data.guildName);
    const group = await findOrCreateGuildGroup(params.data.guildId, body.data.guildName);
    const settings = await prisma.groupSettings.upsert({
      where: { groupId: group.id },
      update: { postSummaryChannelId: body.data.channelId },
      create: { groupId: group.id, postSummaryChannelId: body.data.channelId }
    });

    return reply.send({ groupId: group.id, channelId: settings.postSummaryChannelId });
  });
}
