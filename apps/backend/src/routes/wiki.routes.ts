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
    id?: string;
    name: string;
    description: string;
    status?: string;
    firstSeenSessionId: string | null;
    lastSeenSessionId: string | null;
    firstSeenSessionNumber: number | null;
    lastSeenSessionNumber: number | null;
    sessionCount: number;
    sessionIds?: string[];
    source?: string;
  }>;
  quests: Array<{
    id?: string;
    title: string;
    status: string;
    description?: string;
    notes: string;
    firstSeenSessionId: string | null;
    lastSeenSessionId: string | null;
    allNotes: string[];
    sessionIds?: string[];
    source?: string;
  }>;
  locations: Array<{
    id?: string;
    name: string;
    description: string;
    sessionCount: number;
    sessionIds?: string[];
    source?: string;
  }>;
  threads: Array<{
    id?: string;
    text: string;
    description?: string | undefined;
    status?: string | undefined;
    sessionId: string | null;
    sessionNumber: number | null;
    sessionIds?: string[];
    source?: string;
  }>;
  loot: Array<{
    id?: string;
    item: string;
    description?: string | undefined;
    foundBy: string;
    sessionId: string | null;
    sessionNumber: number | null;
    sessionIds?: string[];
    source?: string;
  }>;
}

export async function wikiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

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
    if (!campaign.group.memberships.length)
      return reply.status(403).send({ error: "Not a member" });

    // Lookup für Session-Nummern (auch Sessions ohne Summary), damit manuelle
    // Einträge korrekt mit first/lastSeenSessionNumber angereichert werden können.
    const sessionNumberMap = new Map<string, number | null>();
    const allSessions = await prisma.session.findMany({
      where: { campaignId },
      select: { id: true, sessionNumber: true }
    });
    for (const s of allSessions) sessionNumberMap.set(s.id, s.sessionNumber ?? null);

    // Manuelle Wiki-Einträge (source='manual') aus den DB-Tabellen laden
    const [manualNpcs, manualQuests, manualLocations, manualThreads, manualLoots] =
      await Promise.all([
        prisma.campaignNPC.findMany({ where: { campaignId, source: "manual" } }),
        prisma.campaignQuest.findMany({ where: { campaignId, source: "manual" } }),
        prisma.campaignLocation.findMany({ where: { campaignId, source: "manual" } }),
        prisma.campaignThread.findMany({ where: { campaignId, source: "manual" } }),
        prisma.campaignLoot.findMany({ where: { campaignId, source: "manual" } })
      ]);

    const wiki: AggregatedWiki = {
      npcs: [],
      quests: [],
      locations: [],
      threads: [],
      loot: []
    };

    // NPC-Aggregation mit Deduplizierung nach Name
    const npcMap = new Map<
      string,
      {
        id?: string;
        name: string;
        description: string;
        status?: string;
        firstSeenSessionId: string | null;
        lastSeenSessionId: string | null;
        firstSeenSessionNumber: number | null;
        lastSeenSessionNumber: number | null;
        sessionCount: number;
        sessionIds?: string[];
        source?: string;
      }
    >();

    // Quest-Aggregation
    const questMap = new Map<
      string,
      {
        id?: string;
        title: string;
        status: string;
        description?: string;
        notes: string;
        firstSeenSessionId: string | null;
        lastSeenSessionId: string | null;
        allNotes: string[];
        sessionIds?: string[];
        source?: string;
      }
    >();

    // Location-Aggregation
    const locationMap = new Map<
      string,
      {
        id?: string;
        name: string;
        description: string;
        sessionCount: number;
        sessionIds?: string[];
        source?: string;
      }
    >();

    for (const session of campaign.sessions) {
      const summary = session.summary;
      if (!summary) continue;

      const sn = session.sessionNumber ?? null;

      // NPCs
      const npcs = (summary.npcs as unknown as SummaryNPC[]) ?? [];
      for (const npc of npcs) {
        if (!npc.name) continue;
        const key = npc.name.toLowerCase().trim();
        const existing = npcMap.get(key);
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
          npcMap.set(key, {
            name: npc.name,
            description: npc.description ?? "",
            firstSeenSessionId: session.id,
            lastSeenSessionId: session.id,
            firstSeenSessionNumber: sn,
            lastSeenSessionNumber: sn,
            sessionCount: 1,
            source: "aggregated"
          });
        }
      }

      // Quests
      const quests = (summary.quests as unknown as SummaryQuest[]) ?? [];
      for (const quest of quests) {
        if (!quest.title) continue;
        const key = quest.title.toLowerCase().trim();
        const existing = questMap.get(key);
        if (existing) {
          existing.lastSeenSessionId = session.id;
          // Status: späterer Status gewinnt (completed > active > discovered)
          const statusPriority: Record<string, number> = {
            discovered: 1,
            active: 2,
            completed: 3,
            failed: 3
          };
          if (
            (statusPriority[quest.status?.toLowerCase()] ?? 0) >
            (statusPriority[existing.status?.toLowerCase()] ?? 0)
          ) {
            existing.status = quest.status;
          }
          if (quest.notes && !existing.allNotes.includes(quest.notes)) {
            existing.allNotes.push(quest.notes);
          }
        } else {
          questMap.set(key, {
            title: quest.title,
            status: quest.status ?? "unknown",
            notes: quest.notes ?? "",
            firstSeenSessionId: session.id,
            lastSeenSessionId: session.id,
            allNotes: quest.notes ? [quest.notes] : [],
            source: "aggregated"
          });
        }
      }

      // Locations
      const locations = (summary.locations as unknown as SummaryLocation[]) ?? [];
      for (const loc of locations) {
        if (!loc.name) continue;
        const key = loc.name.toLowerCase().trim();
        const existing = locationMap.get(key);
        if (existing) {
          existing.sessionCount++;
          if (loc.description && !existing.description.includes(loc.description)) {
            existing.description = existing.description
              ? `${existing.description}; ${loc.description}`
              : loc.description;
          }
        } else {
          locationMap.set(key, {
            name: loc.name,
            description: loc.description ?? "",
            sessionCount: 1,
            source: "aggregated"
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

    // ─── Manuelle Einträge mergen (source='manual') ───
    // NPCs
    for (const m of manualNpcs) {
      const key = m.name.toLowerCase().trim();
      const existing = npcMap.get(key);
      if (existing) {
        existing.id = m.id;
        existing.description = existing.description
          ? `${existing.description}${m.description ? `; ${m.description}` : ""}`
          : (m.description ?? "");
        existing.status = m.status;
        existing.sessionIds = m.sessionIds;
        existing.source = "manual";
      } else {
        const sortedIds = [...m.sessionIds].sort((a, b) => {
          const na = sessionNumberMap.get(a) ?? -1;
          const nb = sessionNumberMap.get(b) ?? -1;
          return na - nb;
        });
        const firstId = sortedIds[0] ?? null;
        const lastId = sortedIds[sortedIds.length - 1] ?? null;
        npcMap.set(key, {
          id: m.id,
          name: m.name,
          description: m.description ?? "",
          status: m.status,
          firstSeenSessionId: firstId,
          lastSeenSessionId: lastId,
          firstSeenSessionNumber: firstId ? (sessionNumberMap.get(firstId) ?? null) : null,
          lastSeenSessionNumber: lastId ? (sessionNumberMap.get(lastId) ?? null) : null,
          sessionCount: m.sessionIds.length,
          sessionIds: m.sessionIds,
          source: "manual"
        });
      }
    }
    // Quests
    for (const m of manualQuests) {
      const key = m.title.toLowerCase().trim();
      const existing = questMap.get(key);
      if (existing) {
        existing.id = m.id;
        existing.notes = existing.notes
          ? `${existing.notes}${m.description ? ` | ${m.description}` : ""}`
          : (m.description ?? "");
        existing.description = m.description ?? undefined;
        existing.status = m.status;
        existing.sessionIds = m.sessionIds;
        existing.source = "manual";
      } else {
        const sortedIds = [...m.sessionIds].sort(
          (a, b) => (sessionNumberMap.get(a) ?? -1) - (sessionNumberMap.get(b) ?? -1)
        );
        const firstId = sortedIds[0] ?? null;
        const lastId = sortedIds[sortedIds.length - 1] ?? null;
        questMap.set(key, {
          id: m.id,
          title: m.title,
          status: m.status,
          description: m.description ?? undefined,
          notes: m.description ?? "",
          firstSeenSessionId: firstId,
          lastSeenSessionId: lastId,
          allNotes: m.description ? [m.description] : [],
          sessionIds: m.sessionIds,
          source: "manual"
        });
      }
    }
    // Locations
    for (const m of manualLocations) {
      const key = m.name.toLowerCase().trim();
      const existing = locationMap.get(key);
      if (existing) {
        existing.id = m.id;
        existing.description = existing.description
          ? `${existing.description}${m.description ? `; ${m.description}` : ""}`
          : (m.description ?? "");
        existing.sessionIds = m.sessionIds;
        existing.source = "manual";
      } else {
        locationMap.set(key, {
          id: m.id,
          name: m.name,
          description: m.description ?? "",
          sessionCount: m.sessionIds.length,
          sessionIds: m.sessionIds,
          source: "manual"
        });
      }
    }
    // Threads
    for (const m of manualThreads) {
      const sortedIds = [...m.sessionIds].sort(
        (a, b) => (sessionNumberMap.get(a) ?? -1) - (sessionNumberMap.get(b) ?? -1)
      );
      const firstId = sortedIds[0] ?? null;
      wiki.threads.push({
        id: m.id,
        text: m.title,
        description: m.description ?? undefined,
        status: m.status,
        sessionId: firstId,
        sessionNumber: firstId ? (sessionNumberMap.get(firstId) ?? null) : null,
        sessionIds: m.sessionIds,
        source: "manual"
      });
    }
    // Loot
    for (const m of manualLoots) {
      const sortedIds = [...m.sessionIds].sort(
        (a, b) => (sessionNumberMap.get(a) ?? -1) - (sessionNumberMap.get(b) ?? -1)
      );
      const firstId = sortedIds[0] ?? null;
      wiki.loot.push({
        id: m.id,
        item: m.name,
        description: m.description ?? undefined,
        foundBy: "",
        sessionId: firstId,
        sessionNumber: firstId ? (sessionNumberMap.get(firstId) ?? null) : null,
        sessionIds: m.sessionIds,
        source: "manual"
      });
    }

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
    if (!campaign.group.memberships.length)
      return reply.status(403).send({ error: "Not a member" });

    const sessionNumberMap = new Map<string, number | null>();
    const allSessions = await prisma.session.findMany({
      where: { campaignId },
      select: { id: true, sessionNumber: true }
    });
    for (const s of allSessions) sessionNumberMap.set(s.id, s.sessionNumber ?? null);

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
            sessionCount: 1,
            source: "aggregated"
          });
        }
      }
    }

    // Manuelle NSCs mergen (source='manual')
    const manualNpcs = await prisma.campaignNPC.findMany({
      where: { campaignId, source: "manual" }
    });
    for (const m of manualNpcs) {
      const key = m.name.toLowerCase().trim();
      const existing = npcMap.get(key);
      if (existing) {
        existing.description = existing.description
          ? `${existing.description}${m.description ? `; ${m.description}` : ""}`
          : (m.description ?? "");
        existing.source = "manual";
      } else {
        const sortedIds = [...m.sessionIds].sort(
          (a, b) => (sessionNumberMap.get(a) ?? -1) - (sessionNumberMap.get(b) ?? -1)
        );
        const firstId = sortedIds[0] ?? null;
        const lastId = sortedIds[sortedIds.length - 1] ?? null;
        npcMap.set(key, {
          name: m.name,
          description: m.description ?? "",
          firstSeenSessionId: firstId,
          lastSeenSessionId: lastId,
          firstSeenSessionNumber: firstId ? (sessionNumberMap.get(firstId) ?? null) : null,
          lastSeenSessionNumber: lastId ? (sessionNumberMap.get(lastId) ?? null) : null,
          sessionCount: m.sessionIds.length,
          source: "manual"
        });
      }
    }

    return reply.send(Array.from(npcMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
  });
}
