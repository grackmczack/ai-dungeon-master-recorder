import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

/**
 * Quest-Wiki Routes — Stufe 1 (Aggregation)
 *
 * Diese Routen aggregieren vorhandene Session-Summaries zu einer
 * kampagnenweiten Wissensbasis. Keine neuen LLM-Calls — nur Parsing
 * und Zusammenführung der JSON-Felder aus Summary-Records.
 *
 * Die persistenten Modelle (CampaignThread, CampaignNPC, CampaignLocation,
 * CampaignQuest) werden später (Stufe 2/3) genutzt. Für Stufe 1 liefern
 * wir einen reinen Aggregations-Endpoint, der on-the-fly aus den
 * Summary-JSONs der Sessions liest.
 */

 /** Session-Summary Types */
interface SummaryNPC {
  name: string;
  description: string;
  firstMention?: string;
}
interface SummaryQuest {
  title: string;
  status: string;
  notes: string;
}
interface SummaryLocation {
  name: string;
  description: string;
}
interface SummaryLoot {
  item: string;
  foundBy: string;
}

interface AggregatedWiki {
  npcs: Array<{
    name: string;
    description: string;
    firstSeenSessionId: string | null;
    lastSeenSessionId: string | null;
    firstSeenSessionNumber: number | null;
    lastSeenSessionNumber: number | null;
    sessionCount: number;
  }>;
  quests: Array<{
    title: string;
    status: string;
    notes: string;
    firstSeenSessionId: string | null;
    lastSeenSessionId: string | null;
    allNotes: string[];
  }>;
  locations: Array<{
    name: string;
    description: string;
    sessionCount: number;
  }>;
  threads: Array<{
    text: string;
    sessionId: string | null;
    sessionNumber: number | null;
  }>;
  loot: Array<{
    item: string;
    foundBy: string;
    sessionId: string | null;
    sessionNumber: number | null;
  }>;
}

export async function wikiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  /**
   * GET /wiki/:campaignId — Aggregiert alle Wiki-Daten aus Session-Summaries
   *
   * Stufe 1: Liest alle Summaries einer Kampagne, parst die JSON-Felder
   * (npcs, quests, locations, openThreads, loot) und fasst sie zusammen.
   */
  app.get("/wiki/:campaignId", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    // Berechtigung prüfen: User muss Mitglied der Gruppe der Kampagne sein
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        group: {
          include: {
            memberships: { where: { userId: sub, leftAt: null } }
          }
        },
        sessions: {
          where: { summary: { isNot: null } },
          orderBy: { sessionNumber: "asc" },
          include: {
            summary: true
          }
        }
      }
    });

    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const wiki: AggregatedWiki = {
      npcs: [],
      quests: [],
      locations: [],
      threads: [],
      loot: []
    };

    // NPC-Aggregation mit Deduplizierung nach Name
    const npcMap = new Map<string, {
      name: string;
      description: string;
      firstSeenSessionId: string | null;
      lastSeenSessionId: string | null;
      firstSeenSessionNumber: number | null;
      lastSeenSessionNumber: number | null;
      sessionCount: number;
    }>();

    // Quest-Aggregation
    const questMap = new Map<string, {
      title: string;
      status: string;
      notes: string;
      firstSeenSessionId: string | null;
      lastSeenSessionId: string | null;
      allNotes: string[];
    }>();

    // Location-Aggregation
    const locationMap = new Map<string, {
      name: string;
      description: string;
      sessionCount: number;
    }>();

    for (const session of campaign.sessions) {
      const summary = session.summary;
      if (!summary) continue;

      const sn = session.sessionNumber ?? null;

      // NPCs
      const npcs = (summary.npcs as unknown as SummaryNPC[]) ?? [];
      for (const npc of npcs) {
        if (!npc.name) continue;
        const existing = npcMap.get(npc.name);
        if (existing) {
          // Letzte Sichtung aktualisieren
          existing.lastSeenSessionId = session.id;
          existing.lastSeenSessionNumber = sn;
          existing.sessionCount++;
          // Beschreibung erweitern, falls neue Info
          if (npc.description && !existing.description.includes(npc.description)) {
            existing.description = existing.description
              ? `${existing.description}; ${npc.description}`
              : npc.description;
          }
        } else {
          npcMap.set(npc.name, {
            name: npc.name,
            description: npc.description ?? "",
            firstSeenSessionId: session.id,
            lastSeenSessionId: session.id,
            firstSeenSessionNumber: sn,
            lastSeenSessionNumber: sn,
            sessionCount: 1
          });
        }
      }

      // Quests
      const quests = (summary.quests as unknown as SummaryQuest[]) ?? [];
      for (const quest of quests) {
        if (!quest.title) continue;
        const existing = questMap.get(quest.title);
        if (existing) {
          existing.lastSeenSessionId = session.id;
          // Status: späterer Status gewinnt (completed > active > discovered)
          const statusPriority: Record<string, number> = { discovered: 1, active: 2, completed: 3, failed: 3 };
          if ((statusPriority[quest.status?.toLowerCase()] ?? 0) > (statusPriority[existing.status?.toLowerCase()] ?? 0)) {
            existing.status = quest.status;
          }
          if (quest.notes && !existing.allNotes.includes(quest.notes)) {
            existing.allNotes.push(quest.notes);
          }
        } else {
          questMap.set(quest.title, {
            title: quest.title,
            status: quest.status ?? "unknown",
            notes: quest.notes ?? "",
            firstSeenSessionId: session.id,
            lastSeenSessionId: session.id,
            allNotes: quest.notes ? [quest.notes] : []
          });
        }
      }

      // Locations
      const locations = (summary.locations as unknown as SummaryLocation[]) ?? [];
      for (const loc of locations) {
        if (!loc.name) continue;
        const existing = locationMap.get(loc.name);
        if (existing) {
          existing.sessionCount++;
          if (loc.description && !existing.description.includes(loc.description)) {
            existing.description = existing.description
              ? `${existing.description}; ${loc.description}`
              : loc.description;
          }
        } else {
          locationMap.set(loc.name, {
            name: loc.name,
            description: loc.description ?? "",
            sessionCount: 1
          });
        }
      }

      // Open Threads (offene Fäden) — pro Session als einzelne Einträge
      const threads = (summary.openThreads as string[]) ?? [];
      for (const thread of threads) {
        if (!thread) continue;
        wiki.threads.push({
          text: thread,
          sessionId: session.id,
          sessionNumber: sn
        });
      }

      // Loot
      const loot = (summary.loot as unknown as SummaryLoot[]) ?? [];
      for (const item of loot) {
        if (!item.item) continue;
        wiki.loot.push({
          item: item.item,
          foundBy: item.foundBy ?? "",
          sessionId: session.id,
          sessionNumber: sn
        });
      }
    }

    // Maps → Arrays
    wiki.npcs = Array.from(npcMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    wiki.quests = Array.from(questMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    wiki.locations = Array.from(locationMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return reply.send({
      campaignId,
      campaignName: campaign.name,
      sessionCount: campaign.sessions.length,
      ...wiki
    });
  });

  /**
   * GET /wiki/:campaignId/npcs — Nur NSCs (fürlazy-loading im Frontend)
   */
  app.get("/wiki/:campaignId/npcs", async (req, reply) => {
    const { campaignId } = req.params as { campaignId: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        group: { include: { memberships: { where: { userId: sub, leftAt: null } } } },
        sessions: {
          where: { summary: { isNot: null } },
          orderBy: { sessionNumber: "asc" },
          include: { summary: true }
        }
      }
    });

    if (!campaign) return reply.status(404).send({ error: "Campaign not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const npcMap = new Map<string, any>();
    for (const session of campaign.sessions) {
      const npcs = (session.summary?.npcs as unknown as SummaryNPC[]) ?? [];
      for (const npc of npcs) {
        if (!npc.name) continue;
        const existing = npcMap.get(npc.name);
        if (existing) {
          existing.lastSeenSessionId = session.id;
          existing.lastSeenSessionNumber = session.sessionNumber ?? null;
          existing.sessionCount++;
          if (npc.description && !existing.description.includes(npc.description)) {
            existing.description = existing.description
              ? `${existing.description}; ${npc.description}`
              : npc.description;
          }
        } else {
          npcMap.set(npc.name, {
            name: npc.name,
            description: npc.description ?? "",
            firstSeenSessionId: session.id,
            lastSeenSessionId: session.id,
            firstSeenSessionNumber: session.sessionNumber ?? null,
            lastSeenSessionNumber: session.sessionNumber ?? null,
            sessionCount: 1
          });
        }
      }
    }

    return reply.send(Array.from(npcMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
  });
}
