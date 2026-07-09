import type { FastifyInstance } from "fastify";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { prisma } from "../db.js";

const BACKGROUND_DIR = path.resolve(process.cwd(), "..", "..", "storage", "campaign-backgrounds");
const ALLOWED_BACKGROUND_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024; // 20 MB — Hintergrundbilder sind meist größer/hochauflösender

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => { await req.jwtVerify(); });

  // PUT /campaigns/:id/context
  app.put("/campaigns/:id/context", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const { campaignContext } = req.body as { campaignContext: string };

    // Prüfen ob User Mitglied der Gruppe ist
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { group: { include: { memberships: { where: { userId: sub, leftAt: null } } } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Not a member" });

    const updated = await prisma.campaign.update({
      where: { id },
      data: { campaignContext, updatedAt: new Date() }
    });

    return reply.send({ updated: true, id: updated.id });
  });

  // PATCH /campaigns/:id — name, description, setting, isActive
  app.patch("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };
    const body = req.body as { name?: string; description?: string; setting?: string; isActive?: boolean };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { group: { include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Only GMs can edit" });

    const updated = await prisma.campaign.update({ where: { id }, data: body });
    return reply.send(updated);
  });

  // POST /campaigns/:id/background — Hintergrundbild fuer Dashboard + Detailansicht hochladen
  app.post("/campaigns/:id/background", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { group: { include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Only GMs can upload a background image" });

    const data = await req.file({ limits: { fileSize: MAX_BACKGROUND_BYTES } });
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    if (!ALLOWED_BACKGROUND_MIME.has(data.mimetype)) {
      return reply.status(400).send({ error: "Only png/jpeg/webp allowed" });
    }

    const buffer = await data.toBuffer();
    const ext = path.extname(data.filename) || ".png";
    const fileName = `${id}-${randomUUID()}${ext}`;

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

  // DELETE /campaigns/:id/background — Hintergrundbild entfernen
  app.delete("/campaigns/:id/background", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sub } = req.user as { sub: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { group: { include: { memberships: { where: { userId: sub, role: "GM", leftAt: null } } } } }
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (!campaign.group.memberships.length) return reply.status(403).send({ error: "Only GMs can remove the background image" });

    if (campaign.backgroundImageUrl) {
      const oldFile = path.basename(campaign.backgroundImageUrl);
      await unlink(path.join(BACKGROUND_DIR, oldFile)).catch(() => undefined);
    }

    await prisma.campaign.update({ where: { id }, data: { backgroundImageUrl: null } });
    return reply.send({ removed: true });
  });
}
