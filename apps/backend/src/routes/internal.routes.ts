/**
 * Interne API-Endpunkte — nur für Bot + Transcriber (nicht öffentlich).
 * Geschützt durch x-internal-token Header.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db.js";

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
      participants: Array<{
        discordUserId: string;
        discordName: string;
        discordDisplayName?: string;
      }>;
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
}
