/**
 * DatabaseService — Bot kommuniziert mit dem Backend via interner HTTP-API.
 * Kein Prisma direkt im Bot — vermeidet Binary/ESM-Probleme.
 */

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://dnd-backend:3001";
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;

if (process.env.NODE_ENV === "production" && !INTERNAL_TOKEN) {
  throw new Error("INTERNAL_TOKEN is required in production");
}

function internalHeaders(): Record<string, string> {
  return { "x-internal-token": INTERNAL_TOKEN ?? "development-only-internal-token" };
}

interface SessionRecord {
  sessionId: string;
  recordingId: string;
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

async function backendPost(path: string, body: unknown): Promise<unknown> {
  return backendRequest(path, "POST", body);
}

async function backendRequest(
  path: string,
  method: "POST" | "PUT" | "DELETE",
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
    const text = await res.text();
    let errorCode = "BACKEND_REQUEST_FAILED";
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string") errorCode = parsed.error;
    } catch {
      // Antworttext bleibt als Diagnose im Error erhalten.
    }
    throw new BackendRequestError(res.status, errorCode, `${path} ${text}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

export async function createSessionRecord(params: {
  guildId: string;
  guildName?: string | undefined;
  filename: string;
  filePath: string;
  durationSeconds: number;
  participantIds: string[];
  participantNames: Map<string, string>;
  participantDisplayNames?: Map<string, string> | undefined;
}): Promise<SessionRecord> {
  const {
    guildId,
    guildName,
    filename,
    filePath,
    durationSeconds,
    participantIds,
    participantNames,
    participantDisplayNames
  } = params;

  const data = (await backendPost("/internal/sessions", {
    guildId,
    guildName,
    filename,
    filePath,
    durationSeconds,
    participants: participantIds.map((id) => ({
      discordUserId: id,
      discordName: participantNames.get(id) ?? id,
      discordDisplayName: participantDisplayNames?.get(id) ?? participantNames.get(id) ?? id
    }))
  })) as SessionRecord;

  console.log(`[DB] Session ${data.sessionId} via Backend-API angelegt`);
  return data;
}

export async function getPostChannel(guildId: string): Promise<string | null> {
  const res = await fetch(`${BACKEND_URL}/internal/guild/${guildId}/post-channel`, {
    headers: internalHeaders()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend post-channel failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { channelId: string | null };
  return data.channelId;
}

export async function setPostChannel(
  guildId: string,
  guildName: string,
  channelId: string | null
): Promise<void> {
  await backendRequest(`/internal/guild/${guildId}/post-channel`, "PUT", {
    guildName,
    channelId
  });
}

export async function syncDiscordInstallation(guildId: string, guildName: string): Promise<void> {
  await backendRequest(`/internal/discord/installations/${guildId}`, "PUT", { guildName });
}

export async function syncDiscordInstallations(
  guilds: Array<{ guildId: string; guildName: string }>
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
