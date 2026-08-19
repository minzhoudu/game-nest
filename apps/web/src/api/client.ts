import type { GameTemplate, NodeSummary, ServerSummary } from '@gamenest/shared-types';

export type { NodeSummary, ServerSummary };

export interface CreateServerInput {
  nodeId: string;
  templateSlug: string;
  name: string;
  env?: Record<string, string>;
}

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
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
