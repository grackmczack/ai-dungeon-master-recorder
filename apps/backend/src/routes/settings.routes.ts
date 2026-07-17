import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  applyAdminKeyProfile,
  getGrantedAdminKeyProfile,
  stripGrantedFields
} from "../lib/admin-api-keys.js";

const DEFAULT_SETTINGS = {
  whisperProvider: "openai",
  whisperApiKey: null,
  whisperEndpoint: null,
  huggingfaceToken: null,
  replicateApiKey: null,
  imageGenModel: "black-forest-labs/flux-schnell",
  sessionImageProvider: "replicate",
  sessionImageModel: "qwen/qwen-image-edit-plus",
  llmProvider: "anthropic",
  llmApiKey: null,
  llmModel: "claude-opus-4-8",
  llmEndpoint: null,
  llmSystemPrompt: null,
  llmCampaignContext: null,
  summaryLanguage: "de",
  postSummaryChannelId: null
};

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
  postSummaryChannelId: z
    .string()
    .regex(/^\d{17,20}$/)
    .optional()
    .nullable(),
  sessionImageProvider: z.enum(["replicate"]).optional().nullable(),
  sessionImageModel: z.string().optional().nullable(),
  usingAdminKeys: z.boolean().optional(),
  adminKeyProviderId: z.string().optional().nullable()
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

    const adminProfile = await getGrantedAdminKeyProfile(prisma, sub);

    const maskKey = (key: string | null) =>
      key ? (key.length > 6 ? `${key.substring(0, 6)}***` : "***") : null;

    const effective = applyAdminKeyProfile(settings ?? DEFAULT_SETTINGS, adminProfile);
    const masked = { ...effective };
    if (masked.whisperApiKey) masked.whisperApiKey = maskKey(masked.whisperApiKey);
    if (masked.replicateApiKey) masked.replicateApiKey = maskKey(masked.replicateApiKey);
    if (masked.huggingfaceToken) masked.huggingfaceToken = maskKey(masked.huggingfaceToken);
    if (masked.llmApiKey) masked.llmApiKey = maskKey(masked.llmApiKey);
    return reply.send({
      ...masked,
      summaryLanguage: "de",
      usingAdminKeys: !!adminProfile,
      adminKeyProviderId: adminProfile?.superAdminId ?? null,
      adminKeyProviderName: adminProfile?.superAdminName ?? null,
      adminKeyAvailability: adminProfile?.availability ?? {
        whisper: false,
        replicate: false,
        huggingface: false,
        llm: false
      }
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
    const adminProfile = await getGrantedAdminKeyProfile(prisma, sub);
    if (
      body.data.usingAdminKeys &&
      (!adminProfile || body.data.adminKeyProviderId !== adminProfile.superAdminId)
    ) {
      return reply.status(409).send({ error: "ADMIN_KEY_GRANT_CHANGED" });
    }

    const {
      usingAdminKeys: _usingAdminKeys,
      adminKeyProviderId: _adminKeyProviderId,
      ...settingsData
    } = body.data;
    let dataToUpdate: Record<string, unknown> = { ...settingsData };
    dataToUpdate.summaryLanguage = "de";
    if (
      typeof dataToUpdate.whisperApiKey === "string" &&
      dataToUpdate.whisperApiKey.includes("***")
    )
      delete dataToUpdate.whisperApiKey;
    if (
      typeof dataToUpdate.replicateApiKey === "string" &&
      dataToUpdate.replicateApiKey.includes("***")
    )
      delete dataToUpdate.replicateApiKey;
    if (
      typeof dataToUpdate.huggingfaceToken === "string" &&
      dataToUpdate.huggingfaceToken.includes("***")
    )
      delete dataToUpdate.huggingfaceToken;
    if (typeof dataToUpdate.llmApiKey === "string" && dataToUpdate.llmApiKey.includes("***"))
      delete dataToUpdate.llmApiKey;

    // Freigegebene Credential-/Provider-Felder gehören dem Superadmin. Eigene
    // bereits gespeicherte Werte des DMs bleiben unangetastet und greifen nach
    // einem Entzug automatisch wieder.
    dataToUpdate = stripGrantedFields(dataToUpdate, adminProfile);

    const settings = await prisma.groupSettings.upsert({
      where: { groupId },
      update: dataToUpdate,
      create: { groupId, ...dataToUpdate }
    });

    return reply.send({ updated: true, id: settings.id });
  });
}
