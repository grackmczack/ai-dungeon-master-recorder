import { auth } from "./auth.js";
import { browser } from "$app/environment";
import type {
  AggregatedWiki,
  WikiNPC,
  User,
  CampaignNPC,
  CampaignQuest,
  CampaignLocation,
  CampaignThread,
  CampaignLoot,
  CreateNPCInput,
  UpdateNPCInput,
  CreateQuestInput,
  UpdateQuestInput,
  CreateLocationInput,
  UpdateLocationInput,
  CreateThreadInput,
  UpdateThreadInput,
  CreateLootInput,
  UpdateLootInput,
  SessionNPC,
  SessionQuest,
  SessionLocation,
  SessionThread,
  SessionLoot
} from "./types.js";

const BASE = "/api";

const ERROR_TRANSLATIONS: Record<string, string> = {
  "Authentication required": "Bitte melde dich an",
  "Invalid or expired session": "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an",
  Unauthorized: "Du bist für diese Aktion nicht berechtigt",
  "Account is inactive": "Konto ist deaktiviert",
  "Admin access required": "Für diese Seite werden Administratorrechte benötigt",
  "Email already registered": "E-Mail ist bereits registriert",
  "Discord server already linked": "Dieser Discord-Server ist bereits mit einer Kampagne verknüpft",
  INVALID_OR_EXPIRED_LINK_TOKEN:
    "Der Verbindungslink ist ungültig oder abgelaufen. Fordere in Discord mit /status einen neuen an",
  DISCORD_SERVER_ALREADY_LINKED: "Dieser Discord-Server wurde bereits verbunden",
  TARGET_CAMPAIGN_NOT_AVAILABLE: "Die ausgewählte Kampagne kann nicht verbunden werden",
  ADMIN_KEYS_NOT_CONFIGURED:
    "Beim Superadmin sind noch keine verwendbaren API-Keys in den Kampagneneinstellungen hinterlegt",
  ADMIN_KEY_GRANT_CHANGED:
    "Die Admin-Key-Freigabe wurde zwischenzeitlich geändert. Lade die Einstellungen neu",
  USER_HAS_ACTIVE_SESSIONS:
    "Der Account hat noch laufende oder zu verarbeitende Sessions und kann derzeit nicht gelöscht werden",
  CAMPAIGN_HAS_ACTIVE_SESSIONS:
    "Die Kampagne hat noch eine laufende oder zu verarbeitende Session und kann derzeit nicht gelöscht werden",
  VOICE_CHANNEL_ALREADY_BOUND: "Dieser Voice-Channel ist bereits einer anderen Kampagne zugeordnet",
  "Campaign not found": "Kampagne wurde nicht gefunden",
  "Session not found": "Session wurde nicht gefunden",
  "Member not found": "Mitglied wurde nicht gefunden",
  "Recording not found": "Aufnahme wurde nicht gefunden",
  "Character sheet not found": "Charakterbogen wurde nicht gefunden",
  "No file uploaded": "Es wurde keine Datei ausgewählt",
  "Only valid PDF files allowed": "Bitte wähle eine gültige PDF-Datei",
  "Only valid png/jpeg/webp images allowed": "Bitte wähle ein gültiges PNG-, JPEG- oder WebP-Bild",
  "Only valid png/jpeg/webp/gif images allowed":
    "Bitte wähle ein gültiges PNG-, JPEG-, WebP- oder GIF-Bild",
  "No Replicate API key configured": "Es ist kein Replicate-API-Key konfiguriert",
  "No Replicate API key configured for this campaign":
    "Für diese Kampagne ist kein Replicate-API-Key konfiguriert"
};

function errorMessage(data: any, status: number): string {
  const error = data?.error;
  if (typeof error === "string") {
    if (ERROR_TRANSLATIONS[error]) return ERROR_TRANSLATIONS[error];
    if (error.startsWith("Only GMs can")) return "Diese Aktion ist nur für Spielleiter verfügbar";
    if (error.endsWith(" not found")) return "Der angeforderte Eintrag wurde nicht gefunden";
    if (error.startsWith("Replicate ") || error.startsWith("Could not download")) {
      return "Die Bildgenerierung konnte nicht abgeschlossen werden";
    }
    return error;
  }
  const fieldErrors = error?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const messages = Object.values(fieldErrors)
      .flat()
      .filter((value) => typeof value === "string");
    if (messages.length) return messages.join(" ");
  }
  if (status >= 500) return "Der Server konnte die Anfrage nicht verarbeiten";
  return "Die Eingabe konnte nicht verarbeitet werden";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {})
  };
  if (options.body && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "same-origin" });

  if (res.status === 401 && browser && !path.startsWith("/auth/")) {
    auth.logout();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, error: errorMessage(data, res.status), statusCode: res.status };
  return data as T;
}

async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  return request<T>(path, { method: "POST", body: form });
}

async function download(path: string): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw { ...data, statusCode: res.status };
  }
  return res.blob();
}

export const api = {
  getDiscordConfig: () =>
    request<{ configured: boolean; inviteUrl: string | null }>("/public/discord"),

  // Auth
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  register: (email: string, password: string, displayName: string) =>
    request<{ email: string; message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName })
    }),
  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token })
    }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email })
    }),
  me: () => request<any>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  updateProfile: (displayName: string) =>
    request<{ user: User }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ displayName })
    }),

  // Kampagnen
  getCampaigns: () => request<any[]>("/campaigns"),
  previewDiscordConnection: (token: string) =>
    request<{
      guildName: string;
      expiresAt: string;
      existingSessions: number;
      campaigns: Array<{ id: string; name: string; description?: string }>;
    }>("/discord-connect/preview", { method: "POST", body: JSON.stringify({ token }) }),
  claimDiscordConnection: (
    token: string,
    data: { targetCampaignId?: string; newCampaignName?: string }
  ) =>
    request<{
      campaignId: string;
      campaignName: string;
      guildName: string;
      mergedSessions: number;
    }>("/discord-connect/claim", { method: "POST", body: JSON.stringify({ token, ...data }) }),
  getCampaign: (id: string) => request<any>(`/campaigns/${id}`),
  createCampaign: (
    dataOrLegacyCampaignId: { name: string; description?: string; setting?: string } | string,
    legacyData?: { name: string; description?: string; setting?: string }
  ) =>
    request<any>("/campaigns", {
      method: "POST",
      body: JSON.stringify(
        typeof dataOrLegacyCampaignId === "string" ? legacyData : dataOrLegacyCampaignId
      )
    }),
  deleteCampaign: (campaignId: string) =>
    request<any>(`/campaigns/${campaignId}`, { method: "DELETE" }),
  getDiscordInstallations: () =>
    request<Array<{ id: string; discordGuildId: string; guildName: string; isActive: boolean }>>(
      "/discord-installations"
    ),
  addCampaignDiscordBinding: (campaignId: string, discordInstallationId: string) =>
    request<any>(`/campaigns/${campaignId}/discord-bindings`, {
      method: "POST",
      body: JSON.stringify({ discordInstallationId })
    }),
  updateCampaignDiscordBinding: (campaignId: string, bindingId: string, data: any) =>
    request<any>(`/campaigns/${campaignId}/discord-bindings/${bindingId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  removeCampaignDiscordBinding: (campaignId: string, bindingId: string) =>
    request<any>(`/campaigns/${campaignId}/discord-bindings/${bindingId}`, { method: "DELETE" }),

  // Members (v1 — direkte Verwaltung, kein Login/Email nötig)
  createMember: (
    campaignId: string,
    data: {
      discordName?: string;
      characterName?: string;
      partyRole?: string;
      role?: string;
      notes?: string;
    }
  ) =>
    request<any>(`/campaigns/${campaignId}/members`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateMember: (
    campaignId: string,
    memberId: string,
    data: {
      discordName?: string | null;
      characterName?: string | null;
      partyRole?: string | null;
      role?: string;
      notes?: string | null;
    }
  ) =>
    request<any>(`/campaigns/${campaignId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  pauseMember: (campaignId: string, memberId: string, note?: string) =>
    request<any>(`/campaigns/${campaignId}/members/${memberId}/pause`, {
      method: "POST",
      body: JSON.stringify({ note })
    }),
  resumeMember: (campaignId: string, memberId: string) =>
    request<any>(`/campaigns/${campaignId}/members/${memberId}/resume`, { method: "POST" }),
  removeMember: (campaignId: string, memberId: string) =>
    request<any>(`/campaigns/${campaignId}/members/${memberId}`, { method: "DELETE" }),
  uploadMemberAvatar: (campaignId: string, memberId: string, file: File) =>
    upload<{ avatarUrl: string }>(`/campaigns/${campaignId}/members/${memberId}/avatar`, file),
  uploadMemberCharacterSheet: (campaignId: string, memberId: string, file: File) =>
    upload<{ characterSheetUrl: string }>(
      `/campaigns/${campaignId}/members/${memberId}/character-sheet`,
      file
    ),
  getMemberCharacterSheet: (campaignId: string, memberId: string) =>
    download(`/campaigns/${campaignId}/members/${memberId}/character-sheet`),

  // Sessions
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  updateSpeakers: (sessionId: string, speakers: any[]) =>
    request<any>(`/sessions/${sessionId}/speakers`, {
      method: "PUT",
      body: JSON.stringify({ speakers })
    }),
  getDiarizationLabels: (sessionId: string) =>
    request<any[]>(`/sessions/${sessionId}/diarization-labels`),
  updateSessionTitle: (sessionId: string, title: string) =>
    request<any>(`/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  uploadSessionImage: (sessionId: string, file: File) =>
    upload<{ sessionImageUrl: string }>(`/sessions/${sessionId}/image`, file),
  getRecording: (sessionId: string, recordingId: string) =>
    download(`/sessions/${sessionId}/recordings/${recordingId}`),
  generateSessionImage: async (sessionId: string, prompt?: string) => {
    const body: Record<string, string> = {};
    if (prompt?.trim()) body.prompt = prompt.trim();
    return request<{ sessionImageUrl: string }>(`/sessions/${sessionId}/generate-image`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  removeSessionImage: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/image`, { method: "DELETE" }),

  // Settings
  getSettings: (campaignId: string) => request<any>(`/campaigns/${campaignId}/settings`),
  updateSettings: (campaignId: string, data: any) =>
    request<any>(`/campaigns/${campaignId}/settings`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  // Campaigns
  updateCampaignContext: (campaignId: string, campaignContext: string) =>
    request<any>(`/campaigns/${campaignId}/context`, {
      method: "PUT",
      body: JSON.stringify({ campaignContext })
    }),
  updateCampaign: (
    campaignId: string,
    data: { name?: string; description?: string; setting?: string; isActive?: boolean }
  ) => request<any>(`/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(data) }),
  getCampaignSessions: (campaignId: string, skip?: number, take?: number) => {
    const params = new URLSearchParams();
    if (skip !== undefined) params.set("skip", String(skip));
    if (take !== undefined) params.set("take", String(take));
    const qs = params.toString();
    return request<{ sessions: any[]; total: number; skip: number; take: number }>(
      `/campaigns/${campaignId}/sessions${qs ? `?${qs}` : ""}`
    );
  },
  // Quest-Wiki
  getCampaignWiki: (campaignId: string) =>
    request<{
      npcs: any[];
      quests: any[];
      locations: any[];
      loot: any[];
      openThreads: string[];
      sessionCount: number;
    }>(`/campaigns/${campaignId}/wiki`),
  uploadCampaignBackground: (campaignId: string, file: File) =>
    upload<{ backgroundImageUrl: string }>(`/campaigns/${campaignId}/background`, file),
  generateCampaignBackground: async (campaignId: string, prompt?: string) => {
    const body: Record<string, string> = {};
    if (prompt?.trim()) body.prompt = prompt.trim();
    return request<{ backgroundImageUrl: string }>(`/campaigns/${campaignId}/generate-background`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  removeCampaignBackground: (campaignId: string) =>
    request<any>(`/campaigns/${campaignId}/background`, { method: "DELETE" }),

  // Quest-Wiki (Stufe 1 — Aggregation aus Session-Summaries)
  getWiki: (campaignId: string) => request<AggregatedWiki>(`/wiki/${campaignId}`),
  getWikiNPCs: (campaignId: string) => request<WikiNPC[]>(`/wiki/${campaignId}/npcs`),

  // ─── Campaign-Level CRUD ─────────────────────────────────────
  createCampaignNPC: (campaignId: string, data: CreateNPCInput) =>
    request<CampaignNPC>(`/campaigns/${campaignId}/npcs`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateCampaignNPC: (campaignId: string, id: string, data: UpdateNPCInput) =>
    request<CampaignNPC>(`/campaigns/${campaignId}/npcs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteCampaignNPC: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/npcs/${id}`, { method: "DELETE" }),
  linkNPCtoSession: (campaignId: string, npcId: string, sessionId: string) =>
    request<any>(`/campaigns/${campaignId}/npcs/${npcId}/link`, {
      method: "POST",
      body: JSON.stringify({ sessionId })
    }),

  createCampaignQuest: (campaignId: string, data: CreateQuestInput) =>
    request<CampaignQuest>(`/campaigns/${campaignId}/quests`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateCampaignQuest: (campaignId: string, id: string, data: UpdateQuestInput) =>
    request<CampaignQuest>(`/campaigns/${campaignId}/quests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteCampaignQuest: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/quests/${id}`, { method: "DELETE" }),
  linkQuestToSession: (campaignId: string, questId: string, sessionId: string) =>
    request<any>(`/campaigns/${campaignId}/quests/${questId}/link`, {
      method: "POST",
      body: JSON.stringify({ sessionId })
    }),

  createCampaignLocation: (campaignId: string, data: CreateLocationInput) =>
    request<CampaignLocation>(`/campaigns/${campaignId}/locations`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateCampaignLocation: (campaignId: string, id: string, data: UpdateLocationInput) =>
    request<CampaignLocation>(`/campaigns/${campaignId}/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteCampaignLocation: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/locations/${id}`, { method: "DELETE" }),
  linkLocationToSession: (campaignId: string, locId: string, sessionId: string) =>
    request<any>(`/campaigns/${campaignId}/locations/${locId}/link`, {
      method: "POST",
      body: JSON.stringify({ sessionId })
    }),

  createCampaignThread: (campaignId: string, data: CreateThreadInput) =>
    request<CampaignThread>(`/campaigns/${campaignId}/threads`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateCampaignThread: (campaignId: string, id: string, data: UpdateThreadInput) =>
    request<CampaignThread>(`/campaigns/${campaignId}/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteCampaignThread: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/threads/${id}`, { method: "DELETE" }),
  linkThreadToSession: (campaignId: string, threadId: string, sessionId: string) =>
    request<any>(`/campaigns/${campaignId}/threads/${threadId}/link`, {
      method: "POST",
      body: JSON.stringify({ sessionId })
    }),

  createCampaignLoot: (campaignId: string, data: CreateLootInput) =>
    request<CampaignLoot>(`/campaigns/${campaignId}/loot`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateCampaignLoot: (campaignId: string, id: string, data: UpdateLootInput) =>
    request<CampaignLoot>(`/campaigns/${campaignId}/loot/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteCampaignLoot: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/loot/${id}`, { method: "DELETE" }),

  // ─── Session-Level CRUD ─────────────────────────────────────
  createSessionNPC: (sessionId: string, campaignId: string, data: CreateNPCInput) =>
    request<SessionNPC>(`/sessions/${sessionId}/npcs`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  createSessionQuest: (sessionId: string, campaignId: string, data: CreateQuestInput) =>
    request<SessionQuest>(`/sessions/${sessionId}/quests`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  createSessionLocation: (sessionId: string, campaignId: string, data: CreateLocationInput) =>
    request<SessionLocation>(`/sessions/${sessionId}/locations`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  createSessionThread: (sessionId: string, campaignId: string, data: CreateThreadInput) =>
    request<SessionThread>(`/sessions/${sessionId}/threads`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  createSessionLoot: (sessionId: string, campaignId: string, data: CreateLootInput) =>
    request<SessionLoot>(`/sessions/${sessionId}/loot`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // ─── Admin ─────────────────────────────────────────────────
  getAdminUsers: () => request<any[]>("/admin/users"),
  createAdminUser: (data: { email: string; password: string; displayName: string }) =>
    request<any>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateAdminUser: (
    id: string,
    data: { displayName?: string; email?: string; isActive?: boolean }
  ) => request<any>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getAdminUserDeletionImpact: (id: string) =>
    request<{
      userId: string;
      displayName: string;
      email: string;
      exclusiveCampaigns: Array<{ id: string; name: string }>;
      sharedCampaigns: Array<{ id: string; name: string }>;
      sessions: number;
      activeSessions: number;
      recordings: number;
      memberships: number;
    }>(`/admin/users/${id}/deletion-impact`),
  deleteAdminUser: (id: string) => request<any>(`/admin/users/${id}`, { method: "DELETE" }),
  grantAdminKeys: (userId: string) =>
    request<any>(`/admin/users/${userId}/grant-keys`, { method: "POST" }),
  revokeAdminKeys: (userId: string) =>
    request<any>(`/admin/users/${userId}/grant-keys`, { method: "DELETE" }),
  getAdminGrants: () => request<any[]>("/admin/grants"),
  getAdminOverview: () => request<any[]>("/admin/overview"),
  getAdminInstallations: () => request<any[]>("/admin/installations")
};
