import { auth } from './auth.js';
import { browser } from '$app/environment';

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
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    }),
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, displayName })
    }),
  me: () => request<any>('/auth/me'),

  // Groups
  getGroups: () => request<any[]>('/groups'),
  createGroup: (data: { name: string; description?: string; discordGuildId?: string }) =>
    request<any>('/groups', { method: 'POST', body: JSON.stringify(data) }),
  getGroup: (id: string) => request<any>(`/groups/${id}`),

  // Members (v1 — direkte Verwaltung, kein Login/Email nötig)
  createMember: (groupId: string, data: { discordName?: string; characterName?: string; partyRole?: string; role?: string; notes?: string }) =>
    request<any>(`/groups/${groupId}/members`, {
      method: 'POST', body: JSON.stringify(data)
    }),
  updateMember: (groupId: string, memberId: string, data: { discordName?: string | null; characterName?: string | null; partyRole?: string | null; role?: string; notes?: string | null }) =>
    request<any>(`/groups/${groupId}/members/${memberId}`, {
      method: 'PATCH', body: JSON.stringify(data)
    }),
  pauseMember: (groupId: string, memberId: string, note?: string) =>
    request<any>(`/groups/${groupId}/members/${memberId}/pause`, {
      method: 'POST', body: JSON.stringify({ note })
    }),
  resumeMember: (groupId: string, memberId: string) =>
    request<any>(`/groups/${groupId}/members/${memberId}/resume`, { method: 'POST' }),
  removeMember: (groupId: string, memberId: string) =>
    request<any>(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),
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
    request<any>(`/sessions/${sessionId}/speakers`, {
      method: 'PUT', body: JSON.stringify({ speakers })
    }),
  getDiarizationLabels: (sessionId: string) =>
    request<any[]>(`/sessions/${sessionId}/diarization-labels`),
  updateSessionTitle: (sessionId: string, title: string) =>
    request<any>(`/sessions/${sessionId}`, {
      method: 'PATCH', body: JSON.stringify({ title })
    }),

  // Settings
  getSettings: (groupId: string) => request<any>(`/groups/${groupId}/settings`),
  updateSettings: (groupId: string, data: any) =>
    request<any>(`/groups/${groupId}/settings`, {
      method: 'PUT', body: JSON.stringify(data)
    })
};
