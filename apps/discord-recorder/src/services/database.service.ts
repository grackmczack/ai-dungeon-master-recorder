/**
 * DatabaseService — Bot-seitige DB-Anbindung via Prisma
 * Legt automatisch Group → Campaign → Session → Recording an
 * wenn noch keine existiert (Discord Guild ID als Ankerpunkt).
 */

// Prisma CJS compat import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const prisma = new PrismaClient();

export interface SessionRecord {
  sessionId: string;
  recordingId: string;
}

/**
 * Stellt sicher dass für diese Guild eine Group + aktive Campaign existiert.
 */
async function ensureGroupAndCampaign(guildId: string, guildName?: string | undefined): Promise<string> {
  let group = await prisma.group.findFirst({ where: { discordGuildId: guildId } });

  if (!group) {
    group = await prisma.group.create({
      data: {
        name: guildName ?? `Discord Server ${guildId}`,
        discordGuildId: guildId,
        description: "Auto-created from Discord bot"
      }
    });
    console.log(`[DB] Gruppe ${group.id} für Guild ${guildId} angelegt`);
  }

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
    console.log(`[DB] Kampagne ${campaign.id} für Gruppe ${group.id} angelegt`);
  }

  return campaign.id;
}

/**
 * Erstellt Session + Recording nach dem Stop.
 */
export async function createSessionRecord(params: {
  guildId: string;
  guildName?: string | undefined;
  filename: string;
  filePath: string;
  durationSeconds: number;
  participantIds: string[];
  participantNames: Map<string, string>;
}): Promise<SessionRecord> {
  const { guildId, guildName, filename, filePath, durationSeconds, participantIds, participantNames } = params;

  const campaignId = await ensureGroupAndCampaign(guildId, guildName);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { _count: { select: { sessions: true } } }
  });
  const sessionNumber = (campaign?._count.sessions ?? 0) + 1;

  const session = await prisma.session.create({
    data: {
      campaignId,
      discordGuildId: guildId,
      sessionNumber,
      status: "PROCESSING",
      stoppedAt: new Date()
    }
  });

  const recording = await prisma.recording.create({
    data: {
      sessionId: session.id,
      filename,
      filePath,
      durationSeconds,
      format: filename.endsWith(".mp3") ? "mp3" : "wav"
    }
  });

  if (participantIds.length > 0) {
    await prisma.speakerMap.createMany({
      data: participantIds.map(userId => ({
        sessionId: session.id,
        discordUserId: userId,
        discordName: participantNames.get(userId) ?? userId
      })),
      skipDuplicates: true
    });
  }

  console.log(`[DB] Session ${session.id} (Nr. ${sessionNumber}) + Recording ${recording.id} angelegt`);
  return { sessionId: session.id, recordingId: recording.id };
}

/**
 * Gibt postSummaryChannelId aus GroupSettings zurück.
 */
export async function getPostChannel(guildId: string): Promise<string | null> {
  const group = await prisma.group.findFirst({
    where: { discordGuildId: guildId },
    include: { settings: true }
  });
  return group?.settings?.postSummaryChannelId ?? null;
}

export { prisma };
