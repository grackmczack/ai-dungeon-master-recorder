/**
 * DatabaseService — der Bot kommuniziert ausschließlich über die interne
 * Backend-API. Kampagnen- und Kanalrouting bleibt dadurch an einer Stelle.
 */

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://dnd-backend:3001";
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;

if (process.env.NODE_ENV === "production" && !INTERNAL_TOKEN) {
  throw new Error("INTERNAL_TOKEN is required in production");
}

function internalHeaders(): Record<string, string> {
  return { "x-internal-token": INTERNAL_TOKEN ?? "development-only-internal-token" };
}

export interface SessionRecord {
  sessionId: string;
  recordingId: string;
  campaignId: string;
  campaignName: string;
  bindingId: string;
  summaryChannelId: string | null;
}

export interface GuildCampaignBinding {
  bindingId: string;
  campaignId: string;
  campaignName: string;
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  summaryChannelId: string | null;
  summaryChannelName: string | null;
  isActive: boolean;
  isDefault: boolean;
}

export interface GuildCampaigns {
  guildId: string;
  guildName: string;
  campaigns: GuildCampaignBinding[];
}

export class BackendRequestError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    details: string
  ) {
    super(`Backend request failed: ${statusCode} ${details}`);
  }
}

async function backendRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...internalHeaders()
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  if (!res.ok) {
    const responseText = await res.text();
    let errorCode = "BACKEND_REQUEST_FAILED";
    try {
      const parsed = JSON.parse(responseText) as { error?: unknown };
      if (typeof parsed.error === "string") errorCode = parsed.error;
    } catch {
      // Der Antworttext bleibt für die Diagnose in der Fehlermeldung erhalten.
    }
    throw new BackendRequestError(res.status, errorCode, `${path} ${responseText}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

export async function createSessionRecord(params: {
  guildId: string;
  guildName?: string | undefined;
  campaignId?: string | undefined;
  voiceChannelId: string;
  voiceChannelName: string;
  textChannelId: string;
  filename: string;
  filePath: string;
  durationSeconds: number;
  participantIds: string[];
  participantNames: Map<string, string>;
  participantDisplayNames?: Map<string, string> | undefined;
}): Promise<SessionRecord> {
  const data = (await backendRequest("/internal/sessions", "POST", {
    guildId: params.guildId,
    guildName: params.guildName,
    campaignId: params.campaignId,
    voiceChannelId: params.voiceChannelId,
    voiceChannelName: params.voiceChannelName,
    textChannelId: params.textChannelId,
    filename: params.filename,
    filePath: params.filePath,
    durationSeconds: params.durationSeconds,
    participants: params.participantIds.map((id) => ({
      discordUserId: id,
      discordName: params.participantNames.get(id) ?? id,
      discordDisplayName:
        params.participantDisplayNames?.get(id) ?? params.participantNames.get(id) ?? id
    }))
  })) as SessionRecord;

  console.log(
    `[DB] Session ${data.sessionId} für Kampagne ${data.campaignName} via Backend-API angelegt`
  );
  return data;
}

export async function markSessionRecordingComplete(sessionId: string): Promise<void> {
  await backendRequest(`/internal/sessions/${sessionId}/recording-complete`, "PATCH", {});
}

export async function getGuildCampaigns(guildId: string): Promise<GuildCampaigns> {
  return (await backendRequest(`/internal/guild/${guildId}/campaigns`, "GET")) as GuildCampaigns;
}

export async function configureCampaignBinding(params: {
  guildId: string;
  guildName: string;
  campaignId: string;
  voiceChannelId: string;
  voiceChannelName: string;
  summaryChannelId?: string | null | undefined;
  summaryChannelName?: string | null | undefined;
  isDefault?: boolean | undefined;
}): Promise<GuildCampaignBinding> {
  return (await backendRequest(`/internal/guild/${params.guildId}/bindings`, "PUT", {
    guildName: params.guildName,
    campaignId: params.campaignId,
    voiceChannelId: params.voiceChannelId,
    voiceChannelName: params.voiceChannelName,
    summaryChannelId: params.summaryChannelId,
    summaryChannelName: params.summaryChannelName,
    isDefault: params.isDefault
  })) as GuildCampaignBinding;
}

export async function setCampaignBindingState(params: {
  guildId: string;
  bindingId: string;
  isActive?: boolean;
  isDefault?: boolean;
}): Promise<GuildCampaignBinding> {
  return (await backendRequest(
    `/internal/guild/${params.guildId}/bindings/${params.bindingId}`,
    "PATCH",
    { isActive: params.isActive, isDefault: params.isDefault }
  )) as GuildCampaignBinding;
}

export async function getPostChannel(
  guildId: string,
  campaignId?: string,
  voiceChannelId?: string
): Promise<string | null> {
  const query = new URLSearchParams();
  if (campaignId) query.set("campaignId", campaignId);
  if (voiceChannelId) query.set("voiceChannelId", voiceChannelId);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const data = (await backendRequest(
    `/internal/guild/${guildId}/post-channel${suffix}`,
    "GET"
  )) as { channelId: string | null };
  return data.channelId;
}

export async function syncDiscordInstallation(guildId: string, guildName: string): Promise<void> {
  await backendRequest(`/internal/discord/installations/${guildId}`, "PUT", { guildName });
}

export async function syncDiscordInstallations(
  guilds: Array<{
    guildId: string;
    guildName: string;
    channels?: Array<{
      channelId: string;
      channelName: string;
      kind: "VOICE" | "TEXT";
    }>;
  }>
): Promise<void> {
  await backendRequest("/internal/discord/installations", "PUT", { guilds });
}

export async function markDiscordInstallationRemoved(guildId: string): Promise<void> {
  await backendRequest(`/internal/discord/installations/${guildId}`, "DELETE");
}

export interface DiscordConnectLink {
  linked: boolean;
  connectUrl: string | null;
  expiresAt: string | null;
  bindingCount?: number;
}

export async function getDiscordConnectLink(
  guildId: string,
  guildName: string
): Promise<DiscordConnectLink> {
  return (await backendRequest("/internal/discord/connect-link", "POST", {
    guildId,
    guildName
  })) as DiscordConnectLink;
}
