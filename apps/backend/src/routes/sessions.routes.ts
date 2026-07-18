import type { FastifyInstance } from "fastify";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { prisma } from "../db.js";
import { getGrantedAdminKeyProfile } from "../lib/admin-api-keys.js";
import { safeStorageFilename, verifyImage } from "../lib/uploads.js";

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

function extractTranscriptSegments(rawJson: unknown): { speaker: string; text: string }[] {
  const raw = rawJson as RawTranscriptJson | null | undefined;
  const chunkedSegments = raw?.chunks?.flatMap((c) => c.segments ?? []);
  const segments = chunkedSegments?.length ? chunkedSegments : (raw?.segments ?? []);
  return segments.map((s) => ({ speaker: s.speaker ?? "", text: s.text ?? "" }));
}

const SESSION_IMAGE_DIR = path.resolve(process.cwd(), "..", "..", "storage", "session-images");
const RECORDING_DIR = path.resolve(process.cwd(), "..", "..", "storage", "recordings");
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const DEFAULT_SESSION_IMAGE_MODEL = "qwen/qwen-image-edit-plus";

function publicBaseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string") return output.startsWith("http") ? output : null;
  if (Array.isArray(output)) {
    for (const item of output) {
      const u = extractOutputUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (output && typeof output === "object") {
    const r = output as Record<string, unknown>;
    if (typeof r.url === "string") return r.url;
    if (typeof r.output === "string") return r.output;
    if (r.output) return extractOutputUrl(r.output);
  }
  return null;
}

async function readErrorBody(res: Response) {
  const text = await res.text();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

/** Prüft ob User GM in der Kampagnen-Gruppe ist */
async function isGm(campaignId: string, userId: string): Promise<boolean> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      group: { include: { memberships: { where: { userId, role: "GM", leftAt: null } } } }
    }
  });
  return !!campaign?.group.memberships.length;
}

export async function sessionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // GET /sessions/:id — full session detail + campaign background for consistency
  app.get("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            group: { include: { memberships: { where: { userId: sub, leftAt: null } } } }
          }
        },
        recordings: true,
        transcript: true,
        summary: true,
        speakerMaps: true
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length)
      return reply.status(403).send({ error: "Not a member" });

    // Campaign-Hintergrundbild für seitenweiten Parallax mitgeben
    return reply.send({
      ...session,
      campaignBackgroundImageUrl: session.campaign.backgroundImageUrl
    });
  });

  // GET /sessions/:id/recordings/:recordingId — authenticated audio stream/download
  app.get("/sessions/:id/recordings/:recordingId", async (req, reply) => {
    const { id, recordingId } = req.params as { id: string; recordingId: string };
    const { sub } = req.user as { sub: string };

    const recording = await prisma.recording.findFirst({
      where: { id: recordingId, sessionId: id },
      include: {
        session: {
          include: {
            campaign: {
              include: {
                group: { include: { memberships: { where: { userId: sub, leftAt: null } } } }
              }
            }
          }
        }
      }
    });

    if (!recording) return reply.status(404).send({ error: "Recording not found" });
    if (!recording.session.campaign.group.memberships.length) {
      return reply.status(403).send({ error: "Not a member" });
    }

    const filename = safeStorageFilename(path.basename(recording.filename));
    if (!filename) return reply.status(404).send({ error: "Recording not found" });

    reply.header("Content-Type", recording.format === "wav" ? "audio/wav" : "audio/mpeg");
    reply.header("Content-Disposition", `inline; filename="${filename}"`);
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(createReadStream(path.join(RECORDING_DIR, filename)));
  });

  // PATCH /sessions/:id — Titel manuell ändern
  app.patch("/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { title } = req.body as { title?: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: {
          include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } }
        }
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length)
      return reply.status(403).send({ error: "Not a member" });

    const updated = await prisma.session.update({ where: { id }, data: { title } });
    return reply.send({ id: updated.id, title: updated.title });
  });

  // PUT /sessions/:id/speakers
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
      include: {
        campaign: {
          include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } }
        }
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length)
      return reply.status(403).send({ error: "Not a member" });

    await Promise.all(
      speakers.map((s) =>
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
      )
    );

    return reply.send({ updated: speakers.length });
  });

  // GET /sessions/:id/diarization-labels
  app.get("/sessions/:id/diarization-labels", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: {
          include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } }
        },
        transcript: true
      }
    });

    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!session.campaign.group.memberships.length)
      return reply.status(403).send({ error: "Not a member" });

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

    return reply.send(Array.from(labels.entries()).map(([label, info]) => ({ label, ...info })));
  });

  // POST /sessions/:id/image — Session-Bild hochladen (GM only)
  app.post("/sessions/:id/image", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({ where: { id }, include: { campaign: true } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!(await isGm(session.campaignId, sub)))
      return reply.status(403).send({ error: "Only GMs can upload session images" });

    const data = await req.file({ limits: { fileSize: MAX_IMAGE_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    const image = verifyImage(buffer, ALLOWED_IMAGE_MIME);
    if (!image) return reply.status(400).send({ error: "Only valid png/jpeg/webp images allowed" });
    const fileName = `${id}-${randomUUID()}${image.extension}`;

    await mkdir(SESSION_IMAGE_DIR, { recursive: true });
    await writeFile(path.join(SESSION_IMAGE_DIR, fileName), buffer);

    if (session.sessionImageUrl) {
      const oldFile = path.basename(session.sessionImageUrl);
      await unlink(path.join(SESSION_IMAGE_DIR, oldFile)).catch(() => undefined);
    }

    const sessionImageUrl = `/uploads/session-images/${fileName}`;
    await prisma.session.update({ where: { id }, data: { sessionImageUrl } });

    return reply.send({ sessionImageUrl });
  });

  // POST /sessions/:id/generate-image — Session-Bild via Replicate generieren (GM only)
  app.post("/sessions/:id/generate-image", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = z.object({ prompt: z.string().optional() }).safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        campaign: { include: { group: { include: { settings: true } } } },
        summary: true,
        speakerMaps: true
      }
    });
    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!(await isGm(session.campaignId, sub)))
      return reply.status(403).send({ error: "Only GMs can generate session images" });

    const adminProfile = await getGrantedAdminKeyProfile(prisma, sub);
    const replicateApiKey =
      adminProfile?.replicateApiKey?.trim() ??
      session.campaign.group.settings?.replicateApiKey?.trim();
    if (!replicateApiKey)
      return reply.status(400).send({ error: "No Replicate API key configured" });

    const sessionImageModel =
      session.campaign.group.settings?.sessionImageModel?.trim() || DEFAULT_SESSION_IMAGE_MODEL;

    // Prompt: Vom User explizit angegeben, oder den vorausgefüllten aus der Summary, oder Fallback
    let prompt = body.data.prompt?.trim() || session.summary?.sessionImagePrompt?.trim() || "";

    if (!prompt) {
      // Fallback: Baue Prompt aus Session-Daten
      const chars = session.speakerMaps
        .map((sm) => sm.characterName || sm.discordName)
        .filter(Boolean);
      const charList = chars.length > 0 ? chars.slice(0, 5).join(", ") : "unknown adventurers";
      prompt = `Epic fantasy illustration for D&D session "${session.title || `Session #${session.sessionNumber || "?"}`}". Characters: ${charList}. Cinematic scene, dramatic lighting, richly detailed tabletop RPG artwork.`;
    }

    // Für qwen-image-edit-plus: Charakter-Avatare als Referenzbilder übergeben
    const isImageEditModel =
      sessionImageModel.includes("image-edit") || sessionImageModel.includes("qwen-image");
    let inputPayload: Record<string, unknown> = { prompt };

    if (isImageEditModel && session.speakerMaps.length > 0) {
      // Hole GroupMemberships für die Charaktere in dieser Session
      const characterNames = session.speakerMaps
        .map((sm) => sm.characterName)
        .filter(Boolean) as string[];

      const membersWithAvatars = await prisma.groupMembership.findMany({
        where: {
          groupId: session.campaign.groupId,
          characterName: { in: characterNames },
          avatarUrl: { not: null },
          leftAt: null
        },
        select: { characterName: true, avatarUrl: true }
      });

      const avatarUrls = membersWithAvatars
        .filter((m) => m.avatarUrl)
        .map((m) => {
          // avatarUrl ist relativ (z.B. "/uploads/avatars/xxx.png")
          // Replicate braucht öffentlich erreichbare URLs
          return new URL(m.avatarUrl!, `${publicBaseUrl()}/`).toString();
        });

      if (avatarUrls.length > 0) {
        inputPayload = {
          prompt,
          image: avatarUrls,
          aspect_ratio: "16:9",
          output_format: "webp",
          go_fast: true
        };
        console.log(
          `[generate-image] Using image-edit model with ${avatarUrls.length} avatar reference(s): ${avatarUrls.join(", ")}`
        );
      } else {
        // Keine Avatare gefunden — falle zurück auf reinen Text-Prompt
        console.log(`[generate-image] No avatar URLs found for characters, using text-only prompt`);
        inputPayload = { prompt, aspect_ratio: "16:9", output_format: "webp", go_fast: true };
      }
    } else {
      // Standard text-to-image (flux-schnell etc.)
      inputPayload = { prompt, aspect_ratio: "16:9", output_format: "webp", go_fast: true };
    }

    const predictionUrl = `https://api.replicate.com/v1/models/${sessionImageModel}/predictions`;
    const createRes = await fetch(predictionUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${replicateApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: inputPayload })
    });

    if (!createRes.ok) {
      const details = await readErrorBody(createRes);
      return reply
        .status(502)
        .send({ error: `Replicate request failed: ${details || createRes.statusText}` });
    }

    let prediction = (await createRes.json()) as {
      id: string;
      status: string;
      output?: unknown;
      error?: string | null;
      urls?: { get?: string };
    };
    let attempts = 0;
    const maxAttempts = 150;

    while (
      prediction.status === "starting" ||
      prediction.status === "processing" ||
      prediction.status === "queued"
    ) {
      if (attempts++ >= maxAttempts)
        return reply.status(504).send({ error: "Replicate prediction timed out" });
      await sleep(2000);
      const pollRes = await fetch(
        prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${replicateApiKey}` } }
      );
      if (!pollRes.ok) {
        const details = await readErrorBody(pollRes);
        return reply
          .status(502)
          .send({ error: `Replicate polling failed: ${details || pollRes.statusText}` });
      }
      prediction = (await pollRes.json()) as typeof prediction;
    }

    if (prediction.status !== "succeeded") {
      return reply.status(502).send({
        error: prediction.error
          ? `Replicate failed: ${prediction.error}`
          : `Replicate status: ${prediction.status}`
      });
    }

    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) return reply.status(502).send({ error: "Replicate returned no image URL" });

    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      const details = await readErrorBody(imageRes);
      return reply
        .status(502)
        .send({ error: `Could not download image: ${details || imageRes.statusText}` });
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const image = verifyImage(buffer, ALLOWED_IMAGE_MIME);
    if (!image) return reply.status(502).send({ error: "Replicate returned an invalid image" });
    const fileName = `${id}${image.extension}`;

    await mkdir(SESSION_IMAGE_DIR, { recursive: true });
    await writeFile(path.join(SESSION_IMAGE_DIR, fileName), buffer);

    if (session.sessionImageUrl) {
      const oldFile = path.basename(session.sessionImageUrl);
      if (oldFile !== fileName)
        await unlink(path.join(SESSION_IMAGE_DIR, oldFile)).catch(() => undefined);
    }

    const sessionImageUrl = `/uploads/session-images/${fileName}`;
    await prisma.session.update({ where: { id }, data: { sessionImageUrl } });

    return reply.send({ sessionImageUrl });
  });

  // DELETE /sessions/:id/image — Session-Bild entfernen (GM only)
  app.delete("/sessions/:id/image", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const session = await prisma.session.findUnique({ where: { id }, include: { campaign: true } });
    if (!session) return reply.status(404).send({ error: "Not found" });
    if (!(await isGm(session.campaignId, sub)))
      return reply.status(403).send({ error: "Only GMs can remove session images" });

    if (session.sessionImageUrl) {
      const oldFile = path.basename(session.sessionImageUrl);
      await unlink(path.join(SESSION_IMAGE_DIR, oldFile)).catch(() => undefined);
    }

    await prisma.session.update({ where: { id }, data: { sessionImageUrl: null } });
    return reply.send({ removed: true });
  });
}
