import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const SettingsSchema = z.object({
  whisperProvider: z.enum(["openai", "replicate", "selfhosted"]).optional(),
  whisperApiKey: z.string().optional().nullable(),
  whisperEndpoint: z.string().optional().nullable(),
  huggingfaceToken: z.string().optional().nullable(),
  replicateApiKey: z.string().optional().nullable(),
  imageGenModel: z.string().optional(),
  llmProvider: z.enum(["anthropic", "gemini", "openai", "siliconflow", "ollama"]).optional(),
  llmApiKey: z.string().optional().nullable(),
  llmModel: z.string().optional().nullable(),
  llmEndpoint: z.string().optional().nullable(),
  llmSystemPrompt: z.string().optional().nullable(),
  llmCampaignContext: z.string().optional().nullable(),
  summaryLanguage: z.literal("de").optional(),
  postSummaryChannelId: z.string().optional().nullable(),
  sessionImageProvider: z.enum(["replicate"]).optional().nullable(),
  sessionImageModel: z.string().optional().nullable()
});

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // GET /groups/:groupId/settings
  app.get("/groups/:groupId/settings", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { sub } = req.user as { sub: string };

    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!membership) return reply.status(403).send({ error: "Only GMs can view settings" });

    const settings = await prisma.groupSettings.findUnique({ where: { groupId } });

    // Check if this DM has admin keys granted (by a SUPER_ADMIN)
    const adminGrant = await prisma.adminApiKeyGrant.findFirst({
      where: { dmId: sub, revokedAt: null },
      select: { superAdminId: true }
    });

    const maskKey = (key: string | null) =>
      key ? (key.length > 6 ? `${key.substring(0, 6)}***` : "***") : null;

    if (settings) {
      // Build response based on whether we're using admin keys or own keys
      const masked = { ...settings };
      if (masked.whisperApiKey) masked.whisperApiKey = maskKey(masked.whisperApiKey);
      if (masked.replicateApiKey) masked.replicateApiKey = maskKey(masked.replicateApiKey);
      if (masked.huggingfaceToken) masked.huggingfaceToken = maskKey(masked.huggingfaceToken);
      if (masked.llmApiKey) masked.llmApiKey = maskKey(masked.llmApiKey);

      return reply.send({
        ...masked,
        summaryLanguage: "de",
        usingAdminKeys: !!adminGrant,
        adminKeyProviderId: adminGrant?.superAdminId ?? null
      });
    }

    return reply.send({
      usingAdminKeys: !!adminGrant,
      adminKeyProviderId: adminGrant?.superAdminId ?? null
    });
  });

  // PUT /groups/:groupId/settings — only GMs
  app.put("/groups/:groupId/settings", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { sub } = req.user as { sub: string };

    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: sub, role: "GM", leftAt: null }
    });
    if (!membership) return reply.status(403).send({ error: "Only GMs can change settings" });

    const body = SettingsSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    // Wenn der Key aus dem Frontend immer noch maskiert ankommt (z.B. "sk-ant-***"), speichern wir ihn nicht ab!
    // Dadurch wird der alte Key in der DB behalten, falls das Frontend nur andere Felder updated.
    const dataToUpdate = { ...body.data };
    dataToUpdate.summaryLanguage = "de";
    if (dataToUpdate.whisperApiKey?.includes("***")) delete dataToUpdate.whisperApiKey;
    if (dataToUpdate.replicateApiKey?.includes("***")) delete dataToUpdate.replicateApiKey;
    if (dataToUpdate.huggingfaceToken?.includes("***")) delete dataToUpdate.huggingfaceToken;
    if (dataToUpdate.llmApiKey?.includes("***")) delete dataToUpdate.llmApiKey;

    const settings = await prisma.groupSettings.upsert({
      where: { groupId },
      update: dataToUpdate,
      create: { groupId, ...dataToUpdate }
    });

    return reply.send({ updated: true, id: settings.id });
  });
}
