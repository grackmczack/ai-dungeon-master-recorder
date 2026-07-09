/**
 * Mitgliederverwaltung — v1
 *
 * Mitglieder sind reine Entitäten, die vom DM/GM verwaltet werden.
 * Sie brauchen KEINEN eigenen Login/Account (das ist v2). userId bleibt daher
 * optional und wird nur für den/die GM(s) genutzt, die sich selbst einloggen.
 *
 * Felder: discordName, characterName, partyRole (Tank/Healer/... frei), avatarUrl,
 * characterSheetUrl (PDF). Volle CRUD-Operationen + pausieren/löschen (soft-delete via leftAt).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { prisma } from "../db.js";

const AVATAR_DIR = path.resolve(process.cwd(), "..", "..", "storage", "avatars");
const SHEET_DIR = path.resolve(process.cwd(), "..", "..", "storage", "character-sheets");

const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ALLOWED_SHEET_MIME = new Set(["application/pdf"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const CreateMemberSchema = z.object({
  discordName: z.string().min(1).optional(),
  characterName: z.string().min(1).optional(),
  partyRole: z.string().optional(),
  role: z.enum(["GM", "PLAYER", "OBSERVER"]).default("PLAYER"),
  notes: z.string().optional()
});

const UpdateMemberSchema = z.object({
  discordName: z.string().min(1).optional().nullable(),
  characterName: z.string().min(1).optional().nullable(),
  partyRole: z.string().optional().nullable(),
  role: z.enum(["GM", "PLAYER", "OBSERVER"]).optional(),
  notes: z.string().optional().nullable()
});

async function requireGm(groupId: string, userId: string) {
  return prisma.groupMembership.findFirst({
    where: { groupId, userId, role: "GM", leftAt: null }
  });
}

async function requireMember(groupId: string, userId: string) {
  return prisma.groupMembership.findFirst({
    where: { groupId, userId, leftAt: null }
  });
}

export async function membersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => {
    await req.jwtVerify();
  });

  // GET /groups/:groupId/members — alle Mitglieder inkl. Historie
  app.get("/groups/:groupId/members", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await requireMember(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Not a member" });

    const members = await prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { joinedAt: "asc" }
    });

    return reply.send(members);
  });

  // POST /groups/:groupId/members — Mitglied direkt anlegen (kein Login/Email nötig)
  app.post("/groups/:groupId/members", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { sub } = req.user as { sub: string };
    const body = CreateMemberSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can add members" });

    const member = await prisma.groupMembership.create({
      data: {
        groupId,
        role: body.data.role,
        discordName: body.data.discordName,
        characterName: body.data.characterName,
        partyRole: body.data.partyRole,
        notes: body.data.notes
      },
      include: { user: { select: { id: true, email: true, displayName: true } } }
    });

    return reply.status(201).send(member);
  });

  // PATCH /groups/:groupId/members/:memberId — Mitglied bearbeiten (alle Felder)
  app.patch("/groups/:groupId/members/:memberId", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };
    const body = UpdateMemberSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can edit members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: body.data,
      include: { user: { select: { id: true, email: true, displayName: true } } }
    });

    return reply.send(updated);
  });

  // POST /groups/:groupId/members/:memberId/pause — Mitglied pausieren
  app.post("/groups/:groupId/members/:memberId/pause", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };
    const { note } = req.body as { note?: string };

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can pause members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { isPaused: true, pausedAt: new Date(), pauseNote: note ?? null }
    });

    return reply.send(updated);
  });

  // POST /groups/:groupId/members/:memberId/resume — Pause aufheben
  app.post("/groups/:groupId/members/:memberId/resume", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can resume members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { isPaused: false, pausedAt: null, pauseNote: null }
    });

    return reply.send(updated);
  });

  // DELETE /groups/:groupId/members/:memberId — Mitglied entfernen (leftAt setzen, kein DELETE)
  app.delete("/groups/:groupId/members/:memberId", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can remove members" });

    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { leftAt: new Date(), isPaused: false }
    });

    return reply.send({ removed: true, id: updated.id, leftAt: updated.leftAt });
  });

  // POST /groups/:groupId/members/:memberId/avatar — Avatar/Gesichtsbild hochladen
  app.post("/groups/:groupId/members/:memberId/avatar", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can upload avatars" });

    const member = await prisma.groupMembership.findFirst({ where: { id: memberId, groupId } });
    if (!member) return reply.status(404).send({ error: "Member not found" });

    const data = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    if (!ALLOWED_AVATAR_MIME.has(data.mimetype)) {
      return reply.status(400).send({ error: "Only png/jpeg/webp/gif allowed" });
    }

    const buffer = await data.toBuffer();
    const ext = path.extname(data.filename) || ".png";
    const fileName = `${memberId}-${randomUUID()}${ext}`;

    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(path.join(AVATAR_DIR, fileName), buffer);

    // Altes Avatarbild aufräumen
    if (member.avatarUrl) {
      const oldFile = path.basename(member.avatarUrl);
      await unlink(path.join(AVATAR_DIR, oldFile)).catch(() => undefined);
    }

    const avatarUrl = `/uploads/avatars/${fileName}`;
    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { avatarUrl }
    });

    return reply.send({ avatarUrl: updated.avatarUrl });
  });

  // POST /groups/:groupId/members/:memberId/character-sheet — Charakterbogen (PDF) hochladen
  app.post("/groups/:groupId/members/:memberId/character-sheet", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    const myMembership = await requireGm(groupId, sub);
    if (!myMembership) return reply.status(403).send({ error: "Only GMs can upload character sheets" });

    const member = await prisma.groupMembership.findFirst({ where: { id: memberId, groupId } });
    if (!member) return reply.status(404).send({ error: "Member not found" });

    const data = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    if (!ALLOWED_SHEET_MIME.has(data.mimetype)) {
      return reply.status(400).send({ error: "Only PDF allowed" });
    }

    const buffer = await data.toBuffer();
    const fileName = `${memberId}-${randomUUID()}.pdf`;

    await mkdir(SHEET_DIR, { recursive: true });
    await writeFile(path.join(SHEET_DIR, fileName), buffer);

    if (member.characterSheetUrl) {
      const oldFile = path.basename(member.characterSheetUrl);
      await unlink(path.join(SHEET_DIR, oldFile)).catch(() => undefined);
    }

    const characterSheetUrl = `/uploads/character-sheets/${fileName}`;
    const updated = await prisma.groupMembership.update({
      where: { id: memberId },
      data: { characterSheetUrl }
    });

    return reply.send({ characterSheetUrl: updated.characterSheetUrl });
  });
}
