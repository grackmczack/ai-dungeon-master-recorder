import { auth } from './auth.js';
import { browser } from '$app/environment';
import type { AggregatedWiki, WikiNPC, User, CampaignNPC, CampaignQuest, CampaignLocation, CampaignThread, CampaignLoot, CreateNPCInput, UpdateNPCInput, CreateQuestInput, UpdateQuestInput, CreateLocationInput, UpdateLocationInput, CreateThreadInput, UpdateThreadInput, CreateLootInput, UpdateLootInput, SessionNPC, SessionQuest, SessionLocation, SessionThread, SessionLoot } from './types.js';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = auth.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && browser) {
    auth.logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw { ...data, statusCode: res.status };
  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: any }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, displayName }) }
    ),
  me: () => request<any>('/auth/me'),

  // Groups
  getGroups: () => request<any[]>('/groups'),
  createGroup: (data: { name: string; description?: string; discordGuildId?: string }) =>
    request<any>(
      '/groups',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  getGroup: (id: string) => request<any>(`/groups/${id}`),

  // Members (v1 — direkte Verwaltung, kein Login/Email nötig)
  createMember: (groupId: string, data: { discordName?: string; characterName?: string; partyRole?: string; role?: string; notes?: string }) =>
    request<any>(
      `/groups/${groupId}/members`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateMember: (groupId: string, memberId: string, data: { discordName?: string | null; characterName?: string | null; partyRole?: string | null; role?: string; notes?: string | null }) =>
    request<any>(
      `/groups/${groupId}/members/${memberId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  pauseMember: (groupId: string, memberId: string, note?: string) =>
    request<any>(
      `/groups/${groupId}/members/${memberId}/pause`,
      { method: 'POST', body: JSON.stringify({ note }) }
    ),
  resumeMember: (groupId: string, memberId: string) =>
    request<any>(
      `/groups/${groupId}/members/${memberId}/resume`,
      { method: 'POST' }
    ),
  removeMember: (groupId: string, memberId: string) =>
    request<any>(
      `/groups/${groupId}/members/${memberId}`,
      { method: 'DELETE' }
    ),
  uploadMemberAvatar: async (groupId: string, memberId: string, file: File) => {
    const token = auth.getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/groups/${groupId}/members/${memberId}/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw { ...data, statusCode: res.status };
    return data as { avatarUrl: string };
  },
  uploadMemberCharacterSheet: async (groupId: string, memberId: string, file: File) => {
    const token = auth.getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/groups/${groupId}/members/${memberId}/character-sheet`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw { ...data, statusCode: res.status };
    return data as { characterSheetUrl: string };
  },

  // Sessions
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  updateSpeakers: (sessionId: string, speakers: any[]) =>
    request<any>(
      `/sessions/${sessionId}/speakers`,
      { method: 'PUT', body: JSON.stringify({ speakers }) }
    ),
  getDiarizationLabels: (sessionId: string) => request<any[]>(`/sessions/${sessionId}/diarization-labels`),
  updateSessionTitle: (sessionId: string, title: string) =>
    request<any>(
      `/sessions/${sessionId}`,
      { method: 'PATCH', body: JSON.stringify({ title }) }
    ),
  uploadSessionImage: async (sessionId: string, file: File) => {
    const token = auth.getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/sessions/${sessionId}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw { ...data, statusCode: res.status };
    return data as { sessionImageUrl: string };
  },
  generateSessionImage: async (sessionId: string, prompt?: string) => {
    const body: Record<string, string> = {};
    if (prompt?.trim()) body.prompt = prompt.trim();
    return request<{ sessionImageUrl: string }>(
      `/sessions/${sessionId}/generate-image`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },
  removeSessionImage: (sessionId: string) =>
    request<any>(`/sessions/${sessionId}/image`, { method: 'DELETE' }),

  // Settings
  getSettings: (groupId: string) => request<any>(`/groups/${groupId}/settings`),
  updateSettings: (groupId: string, data: any) =>
    request<any>(
      `/groups/${groupId}/settings`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),

  // Campaigns
  updateCampaignContext: (campaignId: string, campaignContext: string) =>
    request<any>(
      `/campaigns/${campaignId}/context`,
      { method: 'PUT', body: JSON.stringify({ campaignContext }) }
    ),
  updateCampaign: (campaignId: string, data: { name?: string; description?: string; setting?: string; isActive?: boolean }) =>
    request<any>(
      `/campaigns/${campaignId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  getCampaignSessions: (campaignId: string, skip?: number, take?: number) => {
    const params = new URLSearchParams();
    if (skip !== undefined) params.set('skip', String(skip));
    if (take !== undefined) params.set('take', String(take));
    const qs = params.toString();
    return request<{ sessions: any[]; total: number; skip: number; take: number }>(
      `/campaigns/${campaignId}/sessions${qs ? `?${qs}` : ''}`
    );
  },
  // Quest-Wiki
  getCampaignWiki: (campaignId: string) =>
    request<{ npcs: any[]; quests: any[]; locations: any[]; loot: any[]; openThreads: string[]; sessionCount: number }>(
      `/campaigns/${campaignId}/wiki`
    ),
  uploadCampaignBackground: async (campaignId: string, file: File) => {
    const token = auth.getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/campaigns/${campaignId}/background`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw { ...data, statusCode: res.status };
    return data as { backgroundImageUrl: string };
  },
  generateCampaignBackground: async (campaignId: string, prompt?: string) => {
    const body: Record<string, string> = {};
    if (prompt?.trim()) body.prompt = prompt.trim();
    return request<{ backgroundImageUrl: string }>(
      `/campaigns/${campaignId}/generate-background`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  },
  removeCampaignBackground: (campaignId: string) =>
    request<any>(`/campaigns/${campaignId}/background`, { method: 'DELETE' }),

  // Quest-Wiki (Stufe 1 — Aggregation aus Session-Summaries)
  getWiki: (campaignId: string) =>
    request<AggregatedWiki>(`/wiki/${campaignId}`),
  getWikiNPCs: (campaignId: string) =>
    request<WikiNPC[]>(`/wiki/${campaignId}/npcs`),

  // ─── Campaign-Level CRUD ─────────────────────────────────────
  createCampaignNPC: (campaignId: string, data: CreateNPCInput) =>
    request<CampaignNPC>(
      `/campaigns/${campaignId}/npcs`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateCampaignNPC: (campaignId: string, id: string, data: UpdateNPCInput) =>
    request<CampaignNPC>(
      `/campaigns/${campaignId}/npcs/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteCampaignNPC: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/npcs/${id}`, { method: 'DELETE' }),
  linkNPCtoSession: (campaignId: string, npcId: string, sessionId: string) =>
    request<any>(
      `/campaigns/${campaignId}/npcs/${npcId}/link`,
      { method: 'POST', body: JSON.stringify({ sessionId }) }
    ),

  createCampaignQuest: (campaignId: string, data: CreateQuestInput) =>
    request<CampaignQuest>(
      `/campaigns/${campaignId}/quests`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateCampaignQuest: (campaignId: string, id: string, data: UpdateQuestInput) =>
    request<CampaignQuest>(
      `/campaigns/${campaignId}/quests/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteCampaignQuest: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/quests/${id}`, { method: 'DELETE' }),
  linkQuestToSession: (campaignId: string, questId: string, sessionId: string) =>
    request<any>(
      `/campaigns/${campaignId}/quests/${questId}/link`,
      { method: 'POST', body: JSON.stringify({ sessionId }) }
    ),

  createCampaignLocation: (campaignId: string, data: CreateLocationInput) =>
    request<CampaignLocation>(
      `/campaigns/${campaignId}/locations`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateCampaignLocation: (campaignId: string, id: string, data: UpdateLocationInput) =>
    request<CampaignLocation>(
      `/campaigns/${campaignId}/locations/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteCampaignLocation: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/locations/${id}`, { method: 'DELETE' }),
  linkLocationToSession: (campaignId: string, locId: string, sessionId: string) =>
    request<any>(
      `/campaigns/${campaignId}/locations/${locId}/link`,
      { method: 'POST', body: JSON.stringify({ sessionId }) }
    ),

  createCampaignThread: (campaignId: string, data: CreateThreadInput) =>
    request<CampaignThread>(
      `/campaigns/${campaignId}/threads`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateCampaignThread: (campaignId: string, id: string, data: UpdateThreadInput) =>
    request<CampaignThread>(
      `/campaigns/${campaignId}/threads/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteCampaignThread: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/threads/${id}`, { method: 'DELETE' }),
  linkThreadToSession: (campaignId: string, threadId: string, sessionId: string) =>
    request<any>(
      `/campaigns/${campaignId}/threads/${threadId}/link`,
      { method: 'POST', body: JSON.stringify({ sessionId }) }
    ),

  createCampaignLoot: (campaignId: string, data: CreateLootInput) =>
    request<CampaignLoot>(
      `/campaigns/${campaignId}/loot`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  updateCampaignLoot: (campaignId: string, id: string, data: UpdateLootInput) =>
    request<CampaignLoot>(
      `/campaigns/${campaignId}/loot/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),
  deleteCampaignLoot: (campaignId: string, id: string) =>
    request<any>(`/campaigns/${campaignId}/loot/${id}`, { method: 'DELETE' }),

  // ─── Session-Level CRUD ─────────────────────────────────────
  createSessionNPC: (sessionId: string, campaignId: string, data: CreateNPCInput) =>
    request<SessionNPC>(
      `/sessions/${sessionId}/npcs`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  createSessionQuest: (sessionId: string, campaignId: string, data: CreateQuestInput) =>
    request<SessionQuest>(
      `/sessions/${sessionId}/quests`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  createSessionLocation: (sessionId: string, campaignId: string, data: CreateLocationInput) =>
    request<SessionLocation>(
      `/sessions/${sessionId}/locations`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  createSessionThread: (sessionId: string, campaignId: string, data: CreateThreadInput) =>
    request<SessionThread>(
      `/sessions/${sessionId}/threads`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  createSessionLoot: (sessionId: string, campaignId: string, data: CreateLootInput) =>
    request<SessionLoot>(
      `/sessions/${sessionId}/loot`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  // ─── Admin ─────────────────────────────────────────────────
  getAdminUsers: () => request<any[]>('/admin/users'),
  createAdminUser: (data: { email: string; password: string; displayName: string }) =>
    request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminUser: (id: string, data: { displayName?: string; email?: string; isActive?: boolean }) =>
    request<any>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  grantAdminKeys: (userId: string) =>
    request<any>(`/admin/users/${userId}/grant-keys`, { method: 'POST' }),
  revokeAdminKeys: (userId: string) =>
    request<any>(`/admin/users/${userId}/grant-keys`, { method: 'DELETE' }),
  getAdminGrants: () => request<any[]>('/admin/grants'),
  getAdminOverview: () => request<any[]>('/admin/overview'),
};
