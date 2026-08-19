import type { GameTemplate, NodeSummary, ServerSummary } from '@gamenest/shared-types';
import { clearAuth, getToken } from '../lib/auth-storage';

export type { NodeSummary, ServerSummary };

export interface CreateServerInput {
  nodeId: string;
  templateSlug: string;
  name: string;
  env?: Record<string, string>;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (res.status === 401) {
    // Expired/invalid token — clear it so the UI drops back to logged-out
    // (AuthProvider listens for this) instead of retrying with the same
    // token forever.
    clearAuth();
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body !== null && 'message' in body ? String(body.message) : res.statusText;
    throw new ApiError(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (input: Credentials) => request<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: Credentials) => request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  listNodes: () => request<NodeSummary[]>('/nodes'),
  listTemplates: () => request<GameTemplate[]>('/templates'),
  listServers: () => request<ServerSummary[]>('/servers'),
  getServerLogs: (id: string) => request<string[]>(`/servers/${id}/logs`),
  createServer: (input: CreateServerInput) =>
    request<ServerSummary>('/servers', { method: 'POST', body: JSON.stringify(input) }),
  startServer: (id: string) => request<ServerSummary>(`/servers/${id}/start`, { method: 'POST' }),
  stopServer: (id: string) => request<ServerSummary>(`/servers/${id}/stop`, { method: 'POST' }),
  deleteServer: (id: string) => request<{ deleted: boolean }>(`/servers/${id}`, { method: 'DELETE' }),
};
