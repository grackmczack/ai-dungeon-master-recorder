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
import { createReadStream } from "node:fs";
import { prisma } from "../db.js";
import { isPdf, safeStorageFilename, verifyImage } from "../lib/uploads.js";

const AVATAR_DIR = path.resolve(process.cwd(), "..", "..", "storage", "avatars");
const SHEET_DIR = path.resolve(process.cwd(), "..", "..", "storage", "character-sheets");

const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const CreateMemberSchema = z.object({
  discordName: z.string().min(1).optional(),
  discordDisplayName: z.string().min(1).optional(),
  characterName: z.string().min(1).optional(),
  partyRole: z.string().optional(),
  role: z.enum(["GM", "PLAYER", "OBSERVER"]).default("PLAYER"),
  notes: z.string().optional()
});

const UpdateMemberSchema = z.object({
  discordName: z.string().min(1).optional().nullable(),
  discordDisplayName: z.string().min(1).optional().nullable(),
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

async function findGroupMember(groupId: string, memberId: string) {
  return prisma.groupMembership.findFirst({ where: { id: memberId, groupId } });
}

export async function membersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

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
        discordDisplayName: body.data.discordDisplayName,
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

    const target = await findGroupMember(groupId, memberId);
    if (!target) return reply.status(404).send({ error: "Member not found" });

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

    const target = await findGroupMember(groupId, memberId);
    if (!target) return reply.status(404).send({ error: "Member not found" });

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

    const target = await findGroupMember(groupId, memberId);
    if (!target) return reply.status(404).send({ error: "Member not found" });

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

    const target = await findGroupMember(groupId, memberId);
    if (!target) return reply.status(404).send({ error: "Member not found" });

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

    const member = await findGroupMember(groupId, memberId);
    if (!member) return reply.status(404).send({ error: "Member not found" });

    const data = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    const image = verifyImage(buffer, ALLOWED_AVATAR_MIME);
    if (!image)
      return reply.status(400).send({ error: "Only valid png/jpeg/webp/gif images allowed" });
    const fileName = `${memberId}-${randomUUID()}${image.extension}`;

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
    if (!myMembership)
      return reply.status(403).send({ error: "Only GMs can upload character sheets" });

    const member = await findGroupMember(groupId, memberId);
    if (!member) return reply.status(404).send({ error: "Member not found" });

    const data = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    const buffer = await data.toBuffer();
    if (!isPdf(buffer)) return reply.status(400).send({ error: "Only valid PDF files allowed" });
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

  // GET /groups/:groupId/members/:memberId/character-sheet — authenticated PDF download
  app.get("/groups/:groupId/members/:memberId/character-sheet", async (req, reply) => {
    const { groupId, memberId } = req.params as { groupId: string; memberId: string };
    const { sub } = req.user as { sub: string };

    if (!(await requireMember(groupId, sub))) {
      return reply.status(403).send({ error: "Not a member" });
    }

    const member = await findGroupMember(groupId, memberId);
    if (!member?.characterSheetUrl)
      return reply.status(404).send({ error: "Character sheet not found" });

    const filename = safeStorageFilename(path.basename(member.characterSheetUrl));
    if (!filename) return reply.status(404).send({ error: "Character sheet not found" });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${memberId}-character-sheet.pdf"`);
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(createReadStream(path.join(SHEET_DIR, filename)));
  });
}
