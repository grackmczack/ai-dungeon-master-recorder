import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

interface RawTranscriptSegment {
  speaker?: string;
  text?: string;
}

interface RawTranscriptChunk {
  segments?: RawTranscriptSegment[];
}

interface RawTranscriptJson {
  segments?: RawTranscriptSegment[];
  chunks?: RawTranscriptChunk[];
}

/** Normalisiert Transcript.rawJson (Prisma Json) zu einer flachen Segment-Liste, egal ob chunked oder flach. */
function extractTranscriptSegments(rawJson: unknown): { speaker: string; text: string }[] {
  const raw = rawJson as RawTranscriptJson | null | undefined;
  const chunkedSegments = raw?.chunks?.flatMap((c) => c.segments ?? []);
  const segments = chunkedSegments?.length ? chunkedSegments : (raw?.segments ?? []);
  return segments.map((s) => ({ speaker: s.speaker ?? "", text: s.text ?? "" }));
}

export async function sessionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  // GET /sessions/:id — full session detail with transcript + summary
  app.get("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: { include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } } },
        recordings: true,
        transcript: true,
        summary: true,
        speakerMaps: true
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    return reply.send(session);
  });

  // PATCH /sessions/:id — Titel manuell ändern
  app.patch("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { title } = req.body as { title?: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: { campaign: { include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } } } }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const updated = await prisma.session.update({ where: { id }, data: { title } });
    return reply.send({ id: updated.id, title: updated.title });
  });

  // PUT /sessions/:id/speakers — map Discord user IDs (+ optional Diarization-Label) to character names
  app.put("/sessions/:id/speakers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { speakers } = req.body as {
      speakers: {
        discordUserId: string;
        discordName: string;
        characterName?: string;
        playerName?: string;
        diarizationLabel?: string;
      }[];
    };

    const session = await prisma.session.findUnique({
      where: { id },
      include: { campaign: { include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } } } }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    // Upsert all speaker maps
    await Promise.all(speakers.map(s =>
      prisma.speakerMap.upsert({
        where: { sessionId_discordUserId: { sessionId: id, discordUserId: s.discordUserId } },
        update: {
          characterName: s.characterName,
          playerName: s.playerName,
          discordName: s.discordName,
          diarizationLabel: s.diarizationLabel
        },
        create: { sessionId: id, ...s }
      })
    ));

    return reply.send({ updated: speakers.length });
  });

  // GET /sessions/:id/diarization-labels — alle im Transkript vorkommenden Sprecher-Labels
  // (z.B. SPEAKER_00, SPEAKER_01) — Hilfe für die Sprecher-Zuordnung im Panel
  app.get("/sessions/:id/diarization-labels", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: { include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } } },
        transcript: true
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const allSegments = extractTranscriptSegments(session.transcript?.rawJson);

    const labels = new Map<string, { count: number; sample: string }>();
    for (const seg of allSegments) {
      const label = seg.speaker || "UNKNOWN";
      const entry = labels.get(label);
      if (entry) {
        entry.count++;
      } else {
        labels.set(label, { count: 1, sample: seg.text.slice(0, 120) });
      }
    }

    return reply.send(
      Array.from(labels.entries()).map(([label, info]) => ({ label, ...info }))
    );
  });
}
