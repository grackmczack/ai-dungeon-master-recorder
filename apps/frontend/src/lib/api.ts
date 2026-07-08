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
  inviteMember: (groupId: string, email: string, role = 'PLAYER') =>
    request<any>(`/groups/${groupId}/members`, {
      method: 'POST', body: JSON.stringify({ email, role })
    }),

  // Sessions
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  updateSpeakers: (sessionId: string, speakers: any[]) =>
    request<any>(`/sessions/${sessionId}/speakers`, {
      method: 'PUT', body: JSON.stringify({ speakers })
    }),

  // Settings
  getSettings: (groupId: string) => request<any>(`/groups/${groupId}/settings`),
  updateSettings: (groupId: string, data: any) =>
    request<any>(`/groups/${groupId}/settings`, {
      method: 'PUT', body: JSON.stringify(data)
    })
};
