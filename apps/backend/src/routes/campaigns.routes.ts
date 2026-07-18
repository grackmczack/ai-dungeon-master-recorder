import type { FastifyInstance } from "fastify";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../db.js";
import { getGrantedAdminKeyProfile } from "../lib/admin-api-keys.js";
import { verifyImage } from "../lib/uploads.js";

const BACKGROUND_DIR = path.resolve(process.cwd(), "..", "..", "storage", "campaign-backgrounds");
const SESSION_IMAGE_DIR = path.resolve(process.cwd(), "..", "..", "storage", "session-images");
const RECORDING_DIR = path.resolve(process.cwd(), "..", "..", "storage", "recordings");
const AVATAR_DIR = path.resolve(process.cwd(), "..", "..", "storage", "avatars");
const SHEET_DIR = path.resolve(process.cwd(), "..", "..", "storage", "character-sheets");
const ALLOWED_BACKGROUND_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024; // 20 MB — Hintergrundbilder sind meist größer/hochauflösender
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux-schnell";

const GenerateBackgroundSchema = z.object({
  prompt: z.string().optional()
});
const UpdateCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    setting: z.string().trim().max(200).nullable().optional(),
    isActive: z.boolean().optional()
  })
  .strict();
const CampaignContextSchema = z.object({
  campaignContext: z.string().max(100_000)
});

type ReplicatePrediction = {
  id: string;
  status: string;
  output?: unknown;
  error?: string | null;
  urls?: {
    get?: string;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string") {
    return output.startsWith("http://") ||
      output.startsWith("https://") ||
      output.startsWith("data:")
      ? output
      : null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const found = extractOutputUrl(item);
      if (found) return found;
    }
    return null;
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    if (typeof record.url === "string") return record.url;
    if (typeof record.href === "string") return record.href;
    if (typeof record.output === "string") return record.output;
    if (record.output) {
      const nested = extractOutputUrl(record.output);
      if (nested) return nested;
    }
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

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // PUT /campaigns/:id/context
  app.put("/campaigns/:id/context", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = CampaignContextSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { memberships: { where: { userId: sub, leftAt: null } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const updated = await prisma.campaign.update({
      where: { id },
      data: { campaignContext: body.data.campaignContext, updatedAt: new Date() }
    });

    return reply.send({ updated: true, id: updated.id });
  });

  // PATCH /campaigns/:id — name, description, setting, isActive
  app.patch("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = UpdateCampaignSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length) return reply.status(403).send({ error: "Only GMs can edit" });

    const updated = await prisma.campaign.update({ where: { id }, data: body.data });
    return reply.send(updated);
  });

  // POST /campaigns/:id/background — Hintergrundbild fuer Dashboard + Detailansicht hochladen
  app.post("/campaigns/:id/background", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length)
      return reply.status(403).send({ error: "Only GMs can upload a background image" });

    const data = await req.file({ limits: { fileSize: MAX_BACKGROUND_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    const image = verifyImage(buffer, ALLOWED_BACKGROUND_MIME);
    if (!image) return reply.status(400).send({ error: "Only valid png/jpeg/webp images allowed" });
    const fileName = `${id}-${randomUUID()}${image.extension}`;

    await mkdir(BACKGROUND_DIR, { recursive: true });
    await writeFile(path.join(BACKGROUND_DIR, fileName), buffer);

    if (campaign.backgroundImageUrl) {
      const oldFile = path.basename(campaign.backgroundImageUrl);
      await unlink(path.join(BACKGROUND_DIR, oldFile)).catch(() => undefined);
    }

    const backgroundImageUrl = `/uploads/campaign-backgrounds/${fileName}`;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { backgroundImageUrl }
    });

    return reply.send({ backgroundImageUrl: updated.backgroundImageUrl });
  });

  // POST /campaigns/:id/generate-background — Replicate-Generierung fuer GM-Kampagnen
  app.post("/campaigns/:id/generate-background", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        memberships: { where: { userId: sub, role: "GM", leftAt: null } },
        settings: true
      }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length)
      return reply.status(403).send({ error: "Only GMs can generate a background image" });

    const body = GenerateBackgroundSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const adminProfile = await getGrantedAdminKeyProfile(prisma, sub);
    const replicateApiKey =
      adminProfile?.replicateApiKey?.trim() ?? campaign.settings?.replicateApiKey?.trim();
    if (!replicateApiKey) {
      return reply.status(400).send({ error: "No Replicate API key configured for this campaign" });
    }

    const imageGenModel = campaign.settings?.imageGenModel?.trim() || DEFAULT_IMAGE_MODEL;
    const prompt =
      body.data.prompt?.trim() ||
      `Epic fantasy campaign artwork for "${campaign.name}"${campaign.setting ? ` in ${campaign.setting}` : ""}. Cinematic, dramatic lighting, balanced 4:3 composition, richly detailed tabletop RPG artwork, no text.`;
    const predictionUrl = `https://api.replicate.com/v1/models/${imageGenModel}/predictions`;

    const createRes = await fetch(predictionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "4:3",
          output_format: "webp"
        }
      })
    });

    if (!createRes.ok) {
      const details = await readErrorBody(createRes);
      return reply
        .status(502)
        .send({ error: `Replicate request failed: ${details || createRes.statusText}` });
    }

    let prediction = (await createRes.json()) as ReplicatePrediction;
    let attempts = 0;
    const maxAttempts = 150;

    while (
      prediction.status === "starting" ||
      prediction.status === "processing" ||
      prediction.status === "queued"
    ) {
      if (attempts++ >= maxAttempts) {
        return reply.status(504).send({ error: "Replicate prediction timed out" });
      }

      await sleep(2000);

      const pollRes = await fetch(
        prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { Authorization: `Bearer ${replicateApiKey}` }
        }
      );

      if (!pollRes.ok) {
        const details = await readErrorBody(pollRes);
        return reply
          .status(502)
          .send({ error: `Replicate polling failed: ${details || pollRes.statusText}` });
      }

      prediction = (await pollRes.json()) as ReplicatePrediction;
    }

    if (prediction.status !== "succeeded") {
      return reply.status(502).send({
        error: prediction.error
          ? `Replicate generation failed: ${prediction.error}`
          : `Replicate generation ended with status ${prediction.status}`
      });
    }

    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) {
      return reply.status(502).send({ error: "Replicate returned no image URL" });
    }

    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      const details = await readErrorBody(imageRes);
      return reply
        .status(502)
        .send({ error: `Could not download generated image: ${details || imageRes.statusText}` });
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const image = verifyImage(buffer, ALLOWED_BACKGROUND_MIME);
    if (!image) return reply.status(502).send({ error: "Replicate returned an invalid image" });
    const fileName = `${id}${image.extension}`;
    const filePath = path.join(BACKGROUND_DIR, fileName);

    await mkdir(BACKGROUND_DIR, { recursive: true });
    await writeFile(filePath, buffer);

    if (campaign.backgroundImageUrl) {
      const oldFile = path.basename(
        campaign.backgroundImageUrl.split("?").at(0) ?? campaign.backgroundImageUrl
      );
      if (oldFile !== fileName) {
        await unlink(path.join(BACKGROUND_DIR, oldFile)).catch(() => undefined);
      }
    }

    const backgroundImageUrl = `/uploads/campaign-backgrounds/${fileName}`;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { backgroundImageUrl }
    });

    return reply.send({ backgroundImageUrl: updated.backgroundImageUrl });
  });

  // GET /campaigns/:id/sessions — paginierte Sessions einer Kampagne
  app.get("/campaigns/:id/sessions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const query = req.query as { skip?: string; take?: string };
    const skip = Math.max(0, parseInt(query.skip ?? "0", 10) || 0);
    const take = Math.min(50, Math.max(1, parseInt(query.take ?? "10", 10) || 10));

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { memberships: { where: { userId: sub, leftAt: null } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { campaignId: id },
        orderBy: { startedAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          sessionNumber: true,
          title: true,
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
      }),
      prisma.session.count({ where: { campaignId: id } })
    ]);

    return reply.send({ sessions, total, skip, take });
  });

  // GET /campaigns/:id/wiki — Quest-Wiki Stufe 1: Aggregation aller Session-Summaries
  app.get("/campaigns/:id/wiki", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { memberships: { where: { userId: sub, leftAt: null } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length) return reply.status(403).send({ error: "Not a member" });

    // Alle Summaries dieser Kampagne laden (nur DONE Sessions)
    const summaries = await prisma.summary.findMany({
      where: { session: { campaignId: id, status: "DONE" } },
      include: {
        session: { select: { id: true, sessionNumber: true, title: true, startedAt: true } }
      },
      orderBy: { session: { startedAt: "asc" } }
    });

    // ─── Aggregation ───
    interface NPCEntry {
      name: string;
      description: string;
      firstMention: string;
    }
    interface QuestEntry {
      title: string;
      status: string;
      notes: string;
    }
    interface LocationEntry {
      name: string;
      description: string;
    }
    interface LootEntry {
      item: string;
      foundBy: string;
      source?: string;
      description?: string | undefined;
    }

    // NSCs: deduplizieren via name (case-insensitive), Beschreibungen mergen
    const npcMap = new Map<
      string,
      { name: string; descriptions: string[]; firstMention: string }
    >();
    for (const s of summaries) {
      const npcs = (s.npcs as unknown as unknown as NPCEntry[]) ?? [];
      for (const npc of npcs) {
        const key = npc.name.toLowerCase().trim();
        const existing = npcMap.get(key);
        if (existing) {
          if (npc.description?.trim()) existing.descriptions.push(npc.description.trim());
        } else {
          npcMap.set(key, {
            name: npc.name.trim(),
            descriptions: npc.description?.trim() ? [npc.description.trim()] : [],
            firstMention: npc.firstMention ?? `Session #${s.session.sessionNumber ?? "?"}`
          });
        }
      }
    }

    // Quests: deduplizieren via title, letzter Status gewinnt
    const questMap = new Map<string, { title: string; status: string; notes: string[] }>();
    for (const s of summaries) {
      const quests = (s.quests as unknown as unknown as QuestEntry[]) ?? [];
      for (const q of quests) {
        const key = q.title.toLowerCase().trim();
        const existing = questMap.get(key);
        if (existing) {
          existing.status = q.status || existing.status;
          if (q.notes?.trim()) existing.notes.push(q.notes.trim());
        } else {
          questMap.set(key, {
            title: q.title.trim(),
            status: q.status || "new",
            notes: q.notes?.trim() ? [q.notes.trim()] : []
          });
        }
      }
    }

    // Orte: deduplizieren via name
    const locationMap = new Map<string, { name: string; description: string; source?: string }>();
    for (const s of summaries) {
      const locs = (s.locations as unknown as LocationEntry[]) ?? [];
      for (const l of locs) {
        const key = l.name.toLowerCase().trim();
        if (!locationMap.has(key)) {
          locationMap.set(key, { name: l.name.trim(), description: l.description?.trim() ?? "" });
        }
      }
    }

    // Beute: alle Items flach sammeln (keine Deduplizierung)
    const loot: LootEntry[] = [];
    for (const s of summaries) {
      const items = (s.loot as unknown as unknown as LootEntry[]) ?? [];
      loot.push(...items);
    }

    // Offene Fäden: deduplizieren via exaktem String
    const threadSet = new Set<string>();
    for (const s of summaries) {
      const threads = (s.openThreads as unknown as unknown as string[]) ?? [];
      for (const t of threads) {
        if (t?.trim()) threadSet.add(t.trim());
      }
    }

    // ─── Manuelle Einträge mergen (source='manual') ───
    const [manualNpcs, manualQuests, manualLocations, manualThreads, manualLoots] =
      await Promise.all([
        prisma.campaignNPC.findMany({ where: { campaignId: id, source: "manual" } }),
        prisma.campaignQuest.findMany({ where: { campaignId: id, source: "manual" } }),
        prisma.campaignLocation.findMany({ where: { campaignId: id, source: "manual" } }),
        prisma.campaignThread.findMany({ where: { campaignId: id, source: "manual" } }),
        prisma.campaignLoot.findMany({ where: { campaignId: id, source: "manual" } })
      ]);

    // NSCs
    for (const m of manualNpcs) {
      const key = m.name.toLowerCase().trim();
      const existing = npcMap.get(key);
      if (existing) {
        if (m.description?.trim()) existing.descriptions.push(m.description.trim());
      } else {
        npcMap.set(key, {
          name: m.name.trim(),
          descriptions: m.description?.trim() ? [m.description.trim()] : [],
          firstMention: "Manuell angelegt"
        });
      }
    }
    const npcsFinal = Array.from(npcMap.entries()).map(([key, n]) => {
      const isManual = manualNpcs.some((m) => m.name.toLowerCase().trim() === key);
      return {
        ...n,
        description: n.descriptions.join(" "),
        source: isManual ? "manual" : "aggregated"
      };
    });

    // Quests
    for (const m of manualQuests) {
      const key = m.title.toLowerCase().trim();
      const existing = questMap.get(key);
      if (existing) {
        existing.status = m.status || existing.status;
        if (m.description?.trim()) existing.notes.push(m.description.trim());
      } else {
        questMap.set(key, {
          title: m.title.trim(),
          status: m.status || "new",
          notes: m.description?.trim() ? [m.description.trim()] : []
        });
      }
    }
    const questsFinal = Array.from(questMap.entries()).map(([key, q]) => ({
      ...q,
      notes: q.notes.join(" | "),
      source: manualQuests.some((m) => m.title.toLowerCase().trim() === key)
        ? "manual"
        : "aggregated"
    }));

    // Orte
    for (const m of manualLocations) {
      const key = m.name.toLowerCase().trim();
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          name: m.name.trim(),
          description: m.description?.trim() ?? "",
          source: "manual"
        });
      }
    }
    const locationsFinal = Array.from(locationMap.entries()).map(([key, l]) => ({
      ...l,
      source: manualLocations.some((m) => m.name.toLowerCase().trim() === key)
        ? "manual"
        : "aggregated"
    }));

    // Beute (manuell, flach)
    for (const m of manualLoots) {
      loot.push({
        item: m.name,
        foundBy: "",
        source: "manual",
        description: m.description ?? undefined
      });
    }

    // Offene Fäden (manuell)
    for (const m of manualThreads) {
      threadSet.add(m.title.trim());
    }
    const openThreads = Array.from(threadSet);

    return reply.send({
      campaignId: id,
      sessionCount: summaries.length,
      npcs: npcsFinal,
      quests: questsFinal,
      locations: locationsFinal,
      loot,
      openThreads
    });
  });

  // DELETE /campaigns/:id — Kampagne inklusive Sessions und Uploads löschen.
  app.delete("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        memberships: true,
        sessions: { include: { recordings: true } },
        _count: { select: { sessions: true, memberships: true, bindings: true } }
      }
    });
    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });
    if (
      !campaign.memberships.some(
        (membership) => membership.userId === sub && membership.role === "GM" && !membership.leftAt
      )
    ) {
      return reply.status(403).send({ error: "Only GMs can delete campaigns" });
    }
    if (
      campaign.sessions.some((session) => session.status !== "DONE" && session.status !== "FAILED")
    ) {
      return reply.status(409).send({ error: "CAMPAIGN_HAS_ACTIVE_SESSIONS" });
    }

    const files = [
      ...(campaign.backgroundImageUrl
        ? [[BACKGROUND_DIR, path.basename(campaign.backgroundImageUrl.split("?")[0]!)]]
        : []),
      ...campaign.sessions.flatMap((session) => [
        ...(session.sessionImageUrl
          ? [[SESSION_IMAGE_DIR, path.basename(session.sessionImageUrl.split("?")[0]!)]]
          : []),
        ...session.recordings.map((recording) => [RECORDING_DIR, path.basename(recording.filename)])
      ]),
      ...campaign.memberships.flatMap((membership) => [
        ...(membership.avatarUrl
          ? [[AVATAR_DIR, path.basename(membership.avatarUrl.split("?")[0]!)]]
          : []),
        ...(membership.characterSheetUrl
          ? [[SHEET_DIR, path.basename(membership.characterSheetUrl.split("?")[0]!)]]
          : [])
      ])
    ] as Array<[string, string]>;

    await prisma.campaign.delete({ where: { id } });
    await Promise.all(
      files.map(([directory, filename]) =>
        unlink(path.join(directory, filename)).catch(() => undefined)
      )
    );
    return reply.send({
      deleted: true,
      id,
      sessions: campaign._count.sessions,
      memberships: campaign._count.memberships,
      bindings: campaign._count.bindings,
      files: files.length
    });
  });

  // DELETE /campaigns/:id/background — Hintergrundbild entfernen
  app.delete("/campaigns/:id/background", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.memberships.length)
      return reply.status(403).send({ error: "Only GMs can remove the background image" });

    if (campaign.backgroundImageUrl) {
      const oldFile = path.basename(campaign.backgroundImageUrl);
      await unlink(path.join(BACKGROUND_DIR, oldFile)).catch(() => undefined);
    }

    await prisma.campaign.update({ where: { id }, data: { backgroundImageUrl: null } });
    return reply.send({ removed: true });
  });
}
