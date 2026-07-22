import type { PrismaClient } from "@prisma/client";

export interface AdminKeySourceSettings {
  whisperProvider: string;
  whisperApiKey: string | null;
  whisperEndpoint: string | null;
  replicateApiKey: string | null;
  llmProvider: string;
  llmApiKey: string | null;
  llmModel: string | null;
  llmEndpoint: string | null;
}

export interface AdminKeyAvailability {
  whisper: boolean;
  replicate: boolean;
  llm: boolean;
}

export interface AdminKeyProfile extends Partial<AdminKeySourceSettings> {
  availability: AdminKeyAvailability;
}

export interface ResolvedAdminKeyProfile extends AdminKeyProfile {
  superAdminId: string;
  superAdminName: string;
  grantedAt: Date;
}

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function defaultLlmModel(provider: string): string {
  switch (provider) {
    case "gemini":
      return "gemini-2.5-flash";
    case "openai":
      return "gpt-4o-mini";
    case "siliconflow":
      return "deepseek-ai/DeepSeek-V3";
    case "ollama":
      return "llama3.1";
    default:
      return "claude-opus-4-8";
  }
}

/**
 * Builds one credential profile from all campaigns managed by a super-admin.
 * Provider, model and endpoint are copied from the same row as their key so a
 * Replicate or SiliconFlow key can never accidentally be sent to another API.
 */
export function buildAdminKeyProfile(sources: AdminKeySourceSettings[]): AdminKeyProfile | null {
  const profile: AdminKeyProfile = {
    availability: { whisper: false, replicate: false, llm: false }
  };

  for (const source of sources) {
    if (!profile.availability.whisper && present(source.whisperApiKey)) {
      profile.whisperProvider = source.whisperProvider;
      profile.whisperApiKey = source.whisperApiKey.trim();
      profile.whisperEndpoint = source.whisperEndpoint;
      profile.availability.whisper = true;
    }
    if (!profile.availability.replicate && present(source.replicateApiKey)) {
      profile.replicateApiKey = source.replicateApiKey.trim();
      profile.availability.replicate = true;
    }
    if (!profile.availability.llm && present(source.llmApiKey)) {
      profile.llmProvider = source.llmProvider;
      profile.llmApiKey = source.llmApiKey.trim();
      profile.llmModel = present(source.llmModel)
        ? source.llmModel.trim()
        : defaultLlmModel(source.llmProvider);
      profile.llmEndpoint = source.llmEndpoint;
      profile.availability.llm = true;
    }
  }

  return Object.values(profile.availability).some(Boolean) ? profile : null;
}

export function applyAdminKeyProfile<T extends Record<string, unknown>>(
  settings: T,
  profile: AdminKeyProfile | null
): T & Partial<AdminKeySourceSettings> {
  if (!profile) return { ...settings };
  const effective = { ...settings } as T & Partial<AdminKeySourceSettings>;

  if (profile.availability.whisper) {
    effective.whisperProvider = profile.whisperProvider;
    effective.whisperApiKey = profile.whisperApiKey;
    effective.whisperEndpoint = profile.whisperEndpoint;
  }
  if (profile.availability.replicate) effective.replicateApiKey = profile.replicateApiKey;
  if (profile.availability.llm) {
    effective.llmProvider = profile.llmProvider;
    effective.llmApiKey = profile.llmApiKey;
    effective.llmModel = profile.llmModel;
    effective.llmEndpoint = profile.llmEndpoint;
  }

  return effective;
}

async function loadProfileForSuperAdmin(prisma: PrismaClient, superAdminId: string) {
  const sources = await prisma.campaignSettings.findMany({
    where: {
      campaign: {
        memberships: {
          some: { userId: superAdminId, role: "GM", leftAt: null }
        }
      }
    },
    select: {
      whisperProvider: true,
      whisperApiKey: true,
      whisperEndpoint: true,
      replicateApiKey: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmEndpoint: true
    },
    orderBy: { campaign: { createdAt: "asc" } }
  });
  return buildAdminKeyProfile(sources);
}

export async function getAdminKeyProfileForSuperAdmin(
  prisma: PrismaClient,
  superAdminId: string
): Promise<AdminKeyProfile | null> {
  return loadProfileForSuperAdmin(prisma, superAdminId);
}

export async function getGrantedAdminKeyProfile(
  prisma: PrismaClient,
  dmId: string
): Promise<ResolvedAdminKeyProfile | null> {
  const grants = await prisma.adminApiKeyGrant.findMany({
    where: {
      dmId,
      revokedAt: null,
      superAdmin: { role: "SUPER_ADMIN", isActive: true }
    },
    select: {
      superAdminId: true,
      grantedAt: true,
      superAdmin: { select: { displayName: true } }
    },
    orderBy: { grantedAt: "desc" }
  });

  for (const grant of grants) {
    const profile = await loadProfileForSuperAdmin(prisma, grant.superAdminId);
    if (profile) {
      return {
        ...profile,
        superAdminId: grant.superAdminId,
        superAdminName: grant.superAdmin.displayName,
        grantedAt: grant.grantedAt
      };
    }
  }
  return null;
}

export function stripGrantedFields(
  data: Record<string, unknown>,
  profile: AdminKeyProfile | null
): Record<string, unknown> {
  if (!profile) return data;
  const stripped = { ...data };
  if (profile.availability.whisper) {
    delete stripped.whisperProvider;
    delete stripped.whisperApiKey;
    delete stripped.whisperEndpoint;
  }
  if (profile.availability.replicate) delete stripped.replicateApiKey;
  if (profile.availability.llm) {
    delete stripped.llmProvider;
    delete stripped.llmApiKey;
    delete stripped.llmModel;
    delete stripped.llmEndpoint;
  }
  return stripped;
}
