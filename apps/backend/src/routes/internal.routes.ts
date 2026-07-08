/**
 * Interne API-Endpunkte — nur für Bot + Transcriber (nicht öffentlich).
 * Geschützt durch x-internal-token Header.
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "internal";

function checkToken(req: any, reply: any) {
  if (req.headers["x-internal-token"] !== INTERNAL_TOKEN) {
    reply.status(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export async function internalRoutes(app: FastifyInstance) {
  // POST /internal/sessions — Bot legt Session + Recording an
  app.post("/internal/sessions", async (req, reply) => {
    if (!checkToken(req, reply)) return;

    const { guildId, guildName, filename, filePath, durationSeconds, participants } = req.body as {
      guildId: string;
      guildName?: string;
      filename: string;
      filePath: string;
      durationSeconds: number;
      participants: Array<{ discordUserId: string; discordName: string }>;
    };

    // Group finden oder anlegen
    let group = await prisma.group.findFirst({ where: { discordGuildId: guildId } });
    if (!group) {
      group = await prisma.group.create({
        data: {
          name: guildName ?? `Discord Server ${guildId}`,
          discordGuildId: guildId,
          description: "Auto-created from Discord bot"
        }
      });
      console.log(`[INTERNAL] Gruppe ${group.id} für Guild ${guildId} angelegt`);
    }

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

    // SpeakerMaps anlegen
    if (participants.length > 0) {
      await prisma.speakerMap.createMany({
        data: participants.map(p => ({ sessionId: session.id, ...p })),
        skipDuplicates: true
      });
    }

    console.log(`[INTERNAL] Session ${session.id} (#${sessionNumber}) + Recording ${recording.id} angelegt`);
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
}
