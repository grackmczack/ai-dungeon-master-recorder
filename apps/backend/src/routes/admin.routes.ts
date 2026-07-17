import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { getAdminKeyProfileForSuperAdmin } from "../lib/admin-api-keys.js";
import { buildUserDeletionPlan, removeUserFiles } from "../lib/user-deletion.js";

const CreateDMInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80)
});

const UpdateDMInput = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  isActive: z.boolean().optional()
});

/**
 * Admin-Routes — nur für SUPER_ADMIN
 *
 * Verwaltet DMs, API-Key-Grants und Übersicht.
 */
export async function adminRoutes(app: FastifyInstance) {
  // Alle Admin-Routen sind JWT-geschützt
  app.addHook("preHandler", async (req, reply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const { sub } = req.user as { sub: string };

    // Berechtigungs-Check: Nur SUPER_ADMIN darf Admin-Routen nutzen
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { role: true, isActive: true }
    });

    if (!user || user.role !== "SUPER_ADMIN" || !user.isActive) {
      return reply.status(403).send({ error: "Admin access required" });
    }
  });

  // ─── Benutzerverwaltung ─────────────────────────────────────

  /** GET /admin/users — Alle DMs auflisten */
  app.get("/admin/users", async (req, reply) => {
    const { sub: superAdminId } = req.user as { sub: string };
    const adminProfile = await getAdminKeyProfileForSuperAdmin(prisma, superAdminId);
    const users = await prisma.user.findMany({
      where: { role: "DM" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        memberships: {
          where: { leftAt: null },
          select: {
            group: { select: { id: true, _count: { select: { campaigns: true } } } }
          }
        },
        // Aktive Key-Grants (nicht revoked)
        receivedKeys: {
          where: { revokedAt: null },
          select: { id: true, grantedAt: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return reply.send(
      users.map((u) => {
        const groups = new Map(
          u.memberships.map((membership) => [membership.group.id, membership.group])
        );
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
          groupCount: groups.size,
          campaignCount: Array.from(groups.values()).reduce(
            (sum, group) => sum + group._count.campaigns,
            0
          ),
          hasAdminKeys: u.receivedKeys.length > 0,
          keyGrantedAt: u.receivedKeys[0]?.grantedAt ?? null,
          availableAdminKeys: adminProfile?.availability ?? {
            whisper: false,
            replicate: false,
            huggingface: false,
            llm: false
          }
        };
      })
    );
  });

  /** POST /admin/users — Neuen DM anlegen */
  app.post("/admin/users", async (req, reply) => {
    const body = CreateDMInput.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.user.findFirst({
      where: { email: { equals: body.data.email, mode: "insensitive" } }
    });
    if (existing) return reply.status(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(body.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        passwordHash,
        displayName: body.data.displayName,
        role: "DM",
        isActive: true
      },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true }
    });

    return reply.status(201).send(user);
  });

  /** PATCH /admin/users/:id — DM bearbeiten (Name, Email, aktiv/deaktiv) */
  app.patch("/admin/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateDMInput.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: "User not found" });
    if (user.role !== "DM") return reply.status(400).send({ error: "Cannot modify non-DM users" });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.data.displayName !== undefined && { displayName: body.data.displayName }),
        ...(body.data.email !== undefined && { email: body.data.email }),
        ...(body.data.isActive !== undefined && { isActive: body.data.isActive }),
        ...(body.data.isActive === false && { sessionVersion: { increment: 1 } })
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    return reply.send(updated);
  });

  /** GET /admin/users/:id/deletion-impact — Auswirkungen vor dem Löschen */
  app.get("/admin/users/:id/deletion-impact", async (req, reply) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.$transaction((tx) => buildUserDeletionPlan(tx, id));
    if (!plan) return reply.status(404).send({ error: "User not found" });
    const { files: _files, ...impact } = plan;
    return reply.send(impact);
  });

  /** DELETE /admin/users/:id — DM-Konto und allein verwaltete Daten löschen */
  app.delete("/admin/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.$transaction(
      async (tx) => {
        const deletionPlan = await buildUserDeletionPlan(tx, id);
        if (!deletionPlan) return null;
        if (deletionPlan.activeSessions > 0) {
          return { deleted: false as const, plan: deletionPlan };
        }

        if (deletionPlan.exclusiveGroups.length > 0) {
          await tx.group.deleteMany({
            where: { id: { in: deletionPlan.exclusiveGroups.map((group) => group.id) } }
          });
        }
        // FK-Cascades entfernen Grants und sämtliche verbleibenden Memberships.
        await tx.user.delete({ where: { id } });
        return { deleted: true as const, plan: deletionPlan };
      },
      { isolationLevel: "Serializable" }
    );
    if (!plan) return reply.status(404).send({ error: "User not found" });
    if (!plan.deleted) {
      return reply.status(409).send({ error: "USER_HAS_ACTIVE_SESSIONS" });
    }

    const removedFiles = await removeUserFiles(plan.plan.files);
    const { files: _files, ...impact } = plan.plan;
    return reply.send({ deleted: true, removedFiles, ...impact });
  });

  // ─── API-Key-Grants ─────────────────────────────────────────

  /** GET /admin/grants — Alle aktiven Grants anzeigen */
  app.get("/admin/grants", async (req, reply) => {
    const grants = await prisma.adminApiKeyGrant.findMany({
      where: { revokedAt: null },
      include: {
        dm: { select: { id: true, email: true, displayName: true } }
      },
      orderBy: { grantedAt: "desc" }
    });

    return reply.send(
      grants.map((g) => ({
        id: g.id,
        dmId: g.dm.id,
        dmEmail: g.dm.email,
        dmDisplayName: g.dm.displayName,
        grantedAt: g.grantedAt
      }))
    );
  });

  /** POST /admin/users/:id/grant-keys — API-Keys für diesen DM freigeben */
  app.post("/admin/users/:id/grant-keys", async (req, reply) => {
    const { id: dmId } = req.params as { id: string };
    const { sub: superAdminId } = req.user as { sub: string };

    // Prüfen ob DM existiert
    const dm = await prisma.user.findUnique({ where: { id: dmId } });
    if (!dm || dm.role !== "DM") return reply.status(404).send({ error: "DM not found" });

    const adminProfile = await getAdminKeyProfileForSuperAdmin(prisma, superAdminId);
    if (!adminProfile) {
      return reply.status(400).send({ error: "ADMIN_KEYS_NOT_CONFIGURED" });
    }

    // Ein entzogener Grant wird über den eindeutigen Schlüssel reaktiviert,
    // statt beim erneuten Freigeben an der Unique-Constraint zu scheitern.
    const grant = await prisma.adminApiKeyGrant.upsert({
      where: { superAdminId_dmId: { superAdminId, dmId } },
      update: { revokedAt: null, grantedAt: new Date() },
      create: { superAdminId, dmId },
      include: {
        dm: { select: { id: true, email: true, displayName: true } }
      }
    });

    return reply.status(201).send({
      id: grant.id,
      dmId: grant.dm.id,
      dmEmail: grant.dm.email,
      dmDisplayName: grant.dm.displayName,
      grantedAt: grant.grantedAt,
      availableAdminKeys: adminProfile.availability
    });
  });

  /** DELETE /admin/users/:id/grant-keys — API-Key-Grant entziehen */
  app.delete("/admin/users/:id/grant-keys", async (req, reply) => {
    const { id: dmId } = req.params as { id: string };
    const { sub: superAdminId } = req.user as { sub: string };

    const grant = await prisma.adminApiKeyGrant.findFirst({
      where: { superAdminId, dmId, revokedAt: null }
    });

    if (!grant) return reply.status(404).send({ error: "No active grant found" });

    await prisma.adminApiKeyGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() }
    });

    return reply.send({ message: "Keys revoked" });
  });

  // ─── Übersicht ──────────────────────────────────────────────

  /** GET /admin/overview — DM-Übersicht mit Kampagnen */
  app.get("/admin/overview", async (req, reply) => {
    const dms = await prisma.user.findMany({
      where: { role: "DM" },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        memberships: {
          where: { leftAt: null },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                _count: { select: { campaigns: true } }
              }
            }
          }
        },
        receivedKeys: {
          where: { revokedAt: null },
          select: { grantedAt: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return reply.send(
      dms.map((dm) => ({
        id: dm.id,
        email: dm.email,
        displayName: dm.displayName,
        isActive: dm.isActive,
        groups: dm.memberships.map((m) => ({
          id: m.group.id,
          name: m.group.name,
          campaignCount: m.group._count.campaigns
        })),
        hasAdminKeys: dm.receivedKeys.length > 0
      }))
    );
  });

  /** GET /admin/installations — Discord-Server mit aktuellem Bot-Status */
  app.get("/admin/installations", async (_req, reply) => {
    const installations = await prisma.discordInstallation.findMany({
      orderBy: [{ isActive: "desc" }, { lastSeenAt: "desc" }]
    });
    const groups = await prisma.group.findMany({
      where: { discordGuildId: { in: installations.map((item) => item.discordGuildId) } },
      select: {
        id: true,
        name: true,
        discordGuildId: true,
        settings: { select: { postSummaryChannelId: true } },
        _count: { select: { campaigns: true, memberships: true } }
      }
    });
    const groupsByGuild = new Map(groups.map((group) => [group.discordGuildId, group]));

    return reply.send(
      installations.map((installation) => {
        const group = groupsByGuild.get(installation.discordGuildId);
        return {
          id: installation.id,
          discordGuildId: installation.discordGuildId,
          guildName: installation.guildName,
          isActive: installation.isActive,
          installedAt: installation.installedAt,
          removedAt: installation.removedAt,
          lastSeenAt: installation.lastSeenAt,
          group: group
            ? {
                id: group.id,
                name: group.name,
                campaignCount: group._count.campaigns,
                memberCount: group._count.memberships,
                postSummaryChannelId: group.settings?.postSummaryChannelId ?? null
              }
            : null
        };
      })
    );
  });
}
