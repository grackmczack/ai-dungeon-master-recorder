import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

/**
 * Quest-Wiki CRUD Routes — Stufe 2/3
 *
 * Ermöglicht das manuelle Anlegen, Bearbeiten und Löschen von Wiki-Entitäten
 * (NPCs, Quests, Locations, Threads, Loot) sowie das Verknüpfen mit Sessions.
 *
 * Alle Endpunkte sind JWT-geschützt und prüfen GM-Mitgliedschaft in der
 * Kampagne. `source` ist immer 'manual' für über diese Routen
 * erstellte Einträge.
 *
 * Zusätzlich gibt es Session-Level-Endpunkte (POST /sessions/:sessionId/*),
 * die eine Entität anlegen UND automatisch mit der Session verknüpfen.
 */

// ─── Zod-Schemas ───────────────────────────────────────────

const NPCStatusEnum = z.enum(["ACTIVE", "DEAD", "UNKNOWN", "ALLY", "ENEMY"]);
const QuestStatusEnum = z.enum(["DISCOVERED", "ACTIVE", "COMPLETED", "FAILED"]);
const ThreadStatusEnum = z.enum(["OPEN", "RESOLVED", "ABANDONED"]);

const createNpcSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: NPCStatusEnum.optional()
});

const updateNpcSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: NPCStatusEnum.optional()
});

const createQuestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: QuestStatusEnum.optional()
});

const updateQuestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: QuestStatusEnum.optional()
});

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional()
});

const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional()
});

const createThreadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: ThreadStatusEnum.optional()
});

const updateThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: ThreadStatusEnum.optional()
});

const createLootSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional()
});

const updateLootSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional()
});

const linkSessionSchema = z.object({
  sessionId: z.string().min(1)
});

// ─── Helpers ───────────────────────────────────────────────

/** Prüft, ob der User GM der Kampagne ist. */
async function requireGmForCampaign(
  campaignId: string,
  userId: string
): Promise<{ ok: boolean; status?: number; body?: unknown }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { memberships: { where: { userId, role: "GM", leftAt: null } } }
  });
  if (!campaign) return { ok: false, status: 404, body: { error: "Campaign not found" } };
  if (!campaign.memberships.length)
    return { ok: false, status: 403, body: { error: "Only GMs can modify the wiki" } };
  return { ok: true };
}

/** Prüft GM-Mitgliedschaft anhand einer SessionId (löst die Kampagne dahinter auf). */
async function requireGmForSession(
  sessionId: string,
  userId: string
): Promise<{ ok: boolean; campaignId?: string; status?: number; body?: unknown }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      campaign: {
        include: { memberships: { where: { userId, role: "GM", leftAt: null } } }
      }
    }
  });
  if (!session) return { ok: false, status: 404, body: { error: "Session not found" } };
  if (!session.campaign.memberships.length)
    return { ok: false, status: 403, body: { error: "Only GMs can modify the wiki" } };
  return { ok: true, campaignId: session.campaignId };
}

export async function wikiCrudRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ════════════════════════════════════════════════════════════
  // NPCs
  // ════════════════════════════════════════════════════════════

  // POST /campaigns/:campaignId/npcs
  app.post("/campaigns/:campaignId/npcs", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createNpcSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      const npc = await prisma.campaignNPC.create({
        data: {
          campaignId,
          name: body.data.name,
          description: body.data.description ?? null,
          status: body.data.status ?? "ACTIVE",
          source: "manual",
          sessionIds: []
        }
      });
      return reply.status(201).send(npc);
    } catch (err: any) {
      if (err?.code === "P2002")
        return reply
          .status(409)
          .send({ error: "An NPC with this name already exists in the campaign" });
      throw err;
    }
  });

  // PATCH /campaigns/:campaignId/npcs/:npcId
  app.patch("/campaigns/:campaignId/npcs/:npcId", async (req, reply) => {
    const { campaignId, npcId } = req.params as { campaignId: string; npcId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = updateNpcSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignNPC.findFirst({ where: { id: npcId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "NPC not found" });

    const npc = await prisma.campaignNPC.update({ where: { id: npcId }, data: body.data });
    return reply.send(npc);
  });

  // DELETE /campaigns/:campaignId/npcs/:npcId
  app.delete("/campaigns/:campaignId/npcs/:npcId", async (req, reply) => {
    const { campaignId, npcId } = req.params as { campaignId: string; npcId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const existing = await prisma.campaignNPC.findFirst({ where: { id: npcId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "NPC not found" });

    await prisma.campaignNPC.delete({ where: { id: npcId } });
    return reply.send({ deleted: true, id: npcId });
  });

  // POST /campaigns/:campaignId/npcs/:npcId/link
  app.post("/campaigns/:campaignId/npcs/:npcId/link", async (req, reply) => {
    const { campaignId, npcId } = req.params as { campaignId: string; npcId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = linkSessionSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignNPC.findFirst({ where: { id: npcId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "NPC not found" });

    const sessionIds = existing.sessionIds.includes(body.data.sessionId)
      ? existing.sessionIds
      : [...existing.sessionIds, body.data.sessionId];

    const npc = await prisma.campaignNPC.update({
      where: { id: npcId },
      data: { sessionIds, lastSeenSessionId: body.data.sessionId }
    });
    return reply.send(npc);
  });

  // ════════════════════════════════════════════════════════════
  // Quests
  // ════════════════════════════════════════════════════════════

  // POST /campaigns/:campaignId/quests
  app.post("/campaigns/:campaignId/quests", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createQuestSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const quest = await prisma.campaignQuest.create({
      data: {
        campaignId,
        title: body.data.title,
        description: body.data.description ?? null,
        status: body.data.status ?? "DISCOVERED",
        source: "manual",
        sessionIds: []
      }
    });
    return reply.status(201).send(quest);
  });

  // PATCH /campaigns/:campaignId/quests/:questId
  app.patch("/campaigns/:campaignId/quests/:questId", async (req, reply) => {
    const { campaignId, questId } = req.params as { campaignId: string; questId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = updateQuestSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignQuest.findFirst({ where: { id: questId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Quest not found" });

    const quest = await prisma.campaignQuest.update({ where: { id: questId }, data: body.data });
    return reply.send(quest);
  });

  // DELETE /campaigns/:campaignId/quests/:questId
  app.delete("/campaigns/:campaignId/quests/:questId", async (req, reply) => {
    const { campaignId, questId } = req.params as { campaignId: string; questId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const existing = await prisma.campaignQuest.findFirst({ where: { id: questId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Quest not found" });

    await prisma.campaignQuest.delete({ where: { id: questId } });
    return reply.send({ deleted: true, id: questId });
  });

  // POST /campaigns/:campaignId/quests/:questId/link
  app.post("/campaigns/:campaignId/quests/:questId/link", async (req, reply) => {
    const { campaignId, questId } = req.params as { campaignId: string; questId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = linkSessionSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignQuest.findFirst({ where: { id: questId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Quest not found" });

    const sessionIds = existing.sessionIds.includes(body.data.sessionId)
      ? existing.sessionIds
      : [...existing.sessionIds, body.data.sessionId];

    const quest = await prisma.campaignQuest.update({
      where: { id: questId },
      data: { sessionIds }
    });
    return reply.send(quest);
  });

  // ════════════════════════════════════════════════════════════
  // Locations
  // ════════════════════════════════════════════════════════════

  // POST /campaigns/:campaignId/locations
  app.post("/campaigns/:campaignId/locations", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createLocationSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      const location = await prisma.campaignLocation.create({
        data: {
          campaignId,
          name: body.data.name,
          description: body.data.description ?? null,
          source: "manual",
          sessionIds: []
        }
      });
      return reply.status(201).send(location);
    } catch (err: any) {
      if (err?.code === "P2002")
        return reply
          .status(409)
          .send({ error: "A location with this name already exists in the campaign" });
      throw err;
    }
  });

  // PATCH /campaigns/:campaignId/locations/:locId
  app.patch("/campaigns/:campaignId/locations/:locId", async (req, reply) => {
    const { campaignId, locId } = req.params as { campaignId: string; locId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = updateLocationSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignLocation.findFirst({ where: { id: locId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Location not found" });

    const location = await prisma.campaignLocation.update({
      where: { id: locId },
      data: body.data
    });
    return reply.send(location);
  });

  // DELETE /campaigns/:campaignId/locations/:locId
  app.delete("/campaigns/:campaignId/locations/:locId", async (req, reply) => {
    const { campaignId, locId } = req.params as { campaignId: string; locId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const existing = await prisma.campaignLocation.findFirst({ where: { id: locId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Location not found" });

    await prisma.campaignLocation.delete({ where: { id: locId } });
    return reply.send({ deleted: true, id: locId });
  });

  // POST /campaigns/:campaignId/locations/:locId/link
  app.post("/campaigns/:campaignId/locations/:locId/link", async (req, reply) => {
    const { campaignId, locId } = req.params as { campaignId: string; locId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = linkSessionSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignLocation.findFirst({ where: { id: locId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Location not found" });

    const sessionIds = existing.sessionIds.includes(body.data.sessionId)
      ? existing.sessionIds
      : [...existing.sessionIds, body.data.sessionId];

    const location = await prisma.campaignLocation.update({
      where: { id: locId },
      data: { sessionIds }
    });
    return reply.send(location);
  });

  // ════════════════════════════════════════════════════════════
  // Threads
  // ════════════════════════════════════════════════════════════

  // POST /campaigns/:campaignId/threads
  app.post("/campaigns/:campaignId/threads", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createThreadSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const thread = await prisma.campaignThread.create({
      data: {
        campaignId,
        title: body.data.title,
        description: body.data.description ?? null,
        status: body.data.status ?? "OPEN",
        source: "manual",
        sessionIds: []
      }
    });
    return reply.status(201).send(thread);
  });

  // PATCH /campaigns/:campaignId/threads/:threadId
  app.patch("/campaigns/:campaignId/threads/:threadId", async (req, reply) => {
    const { campaignId, threadId } = req.params as { campaignId: string; threadId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = updateThreadSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignThread.findFirst({ where: { id: threadId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Thread not found" });

    const thread = await prisma.campaignThread.update({ where: { id: threadId }, data: body.data });
    return reply.send(thread);
  });

  // DELETE /campaigns/:campaignId/threads/:threadId
  app.delete("/campaigns/:campaignId/threads/:threadId", async (req, reply) => {
    const { campaignId, threadId } = req.params as { campaignId: string; threadId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const existing = await prisma.campaignThread.findFirst({ where: { id: threadId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Thread not found" });

    await prisma.campaignThread.delete({ where: { id: threadId } });
    return reply.send({ deleted: true, id: threadId });
  });

  // POST /campaigns/:campaignId/threads/:threadId/link
  app.post("/campaigns/:campaignId/threads/:threadId/link", async (req, reply) => {
    const { campaignId, threadId } = req.params as { campaignId: string; threadId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = linkSessionSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignThread.findFirst({ where: { id: threadId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Thread not found" });

    const sessionIds = existing.sessionIds.includes(body.data.sessionId)
      ? existing.sessionIds
      : [...existing.sessionIds, body.data.sessionId];

    const thread = await prisma.campaignThread.update({
      where: { id: threadId },
      data: { sessionIds }
    });
    return reply.send(thread);
  });

  // ════════════════════════════════════════════════════════════
  // Loot
  // ════════════════════════════════════════════════════════════

  // POST /campaigns/:campaignId/loot
  app.post("/campaigns/:campaignId/loot", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createLootSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const loot = await prisma.campaignLoot.create({
      data: {
        campaignId,
        name: body.data.name,
        description: body.data.description ?? null,
        source: "manual",
        sessionIds: []
      }
    });
    return reply.status(201).send(loot);
  });

  // PATCH /campaigns/:campaignId/loot/:lootId
  app.patch("/campaigns/:campaignId/loot/:lootId", async (req, reply) => {
    const { campaignId, lootId } = req.params as { campaignId: string; lootId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = updateLootSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.campaignLoot.findFirst({ where: { id: lootId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Loot not found" });

    const loot = await prisma.campaignLoot.update({ where: { id: lootId }, data: body.data });
    return reply.send(loot);
  });

  // DELETE /campaigns/:campaignId/loot/:lootId
  app.delete("/campaigns/:campaignId/loot/:lootId", async (req, reply) => {
    const { campaignId, lootId } = req.params as { campaignId: string; lootId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForCampaign(campaignId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const existing = await prisma.campaignLoot.findFirst({ where: { id: lootId, campaignId } });
    if (!existing) return reply.status(404).send({ error: "Loot not found" });

    await prisma.campaignLoot.delete({ where: { id: lootId } });
    return reply.send({ deleted: true, id: lootId });
  });

  // ════════════════════════════════════════════════════════════
  // Session-Level: Entität anlegen + automatisch mit Session verknüpfen
  // ════════════════════════════════════════════════════════════

  // POST /sessions/:sessionId/npcs
  app.post("/sessions/:sessionId/npcs", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForSession(sessionId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createNpcSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      const npc = await prisma.campaignNPC.create({
        data: {
          campaignId: guard.campaignId!,
          name: body.data.name,
          description: body.data.description ?? null,
          status: body.data.status ?? "ACTIVE",
          source: "manual",
          sessionIds: [sessionId],
          firstSeenSessionId: sessionId,
          lastSeenSessionId: sessionId
        }
      });
      return reply.status(201).send(npc);
    } catch (err: any) {
      if (err?.code === "P2002")
        return reply
          .status(409)
          .send({ error: "An NPC with this name already exists in the campaign" });
      throw err;
    }
  });

  // POST /sessions/:sessionId/quests
  app.post("/sessions/:sessionId/quests", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForSession(sessionId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createQuestSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const quest = await prisma.campaignQuest.create({
      data: {
        campaignId: guard.campaignId!,
        title: body.data.title,
        description: body.data.description ?? null,
        status: body.data.status ?? "DISCOVERED",
        source: "manual",
        sessionIds: [sessionId],
        openedInSessionId: sessionId
      }
    });
    return reply.status(201).send(quest);
  });

  // POST /sessions/:sessionId/locations
  app.post("/sessions/:sessionId/locations", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForSession(sessionId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createLocationSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    try {
      const location = await prisma.campaignLocation.create({
        data: {
          campaignId: guard.campaignId!,
          name: body.data.name,
          description: body.data.description ?? null,
          source: "manual",
          sessionIds: [sessionId]
        }
      });
      return reply.status(201).send(location);
    } catch (err: any) {
      if (err?.code === "P2002")
        return reply
          .status(409)
          .send({ error: "A location with this name already exists in the campaign" });
      throw err;
    }
  });

  // POST /sessions/:sessionId/threads
  app.post("/sessions/:sessionId/threads", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForSession(sessionId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createThreadSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const thread = await prisma.campaignThread.create({
      data: {
        campaignId: guard.campaignId!,
        title: body.data.title,
        description: body.data.description ?? null,
        status: body.data.status ?? "OPEN",
        source: "manual",
        sessionIds: [sessionId],
        openedInSessionId: sessionId
      }
    });
    return reply.status(201).send(thread);
  });

  // POST /sessions/:sessionId/loot
  app.post("/sessions/:sessionId/loot", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const { sub } = req.user as { sub: string };

    const guard = await requireGmForSession(sessionId, sub);
    if (!guard.ok) return reply.status(guard.status!).send(guard.body);

    const body = createLootSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const loot = await prisma.campaignLoot.create({
      data: {
        campaignId: guard.campaignId!,
        name: body.data.name,
        description: body.data.description ?? null,
        source: "manual",
        sessionIds: [sessionId]
      }
    });
    return reply.status(201).send(loot);
  });
}
