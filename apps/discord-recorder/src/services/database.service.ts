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

async function backendPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${path} failed: ${res.status} ${text}`);
  }
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
  try {
    const res = await fetch(`${BACKEND_URL}/internal/guild/${guildId}/post-channel`, {
      headers: internalHeaders()
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { channelId: string | null };
    return data.channelId;
  } catch {
    return null;
  }
}
