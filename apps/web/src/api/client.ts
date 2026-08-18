import type { GameTemplate, ServerStatus } from '@gamenest/shared-types';

// These two shapes mirror what api's in-memory registries return today
// (NodeRegistryService.list() / ServersService.list()) — NOT the GameNode /
// GameServer entities from shared-types, which describe the *persisted*
// shape once Prisma wiring lands. Update these once that happens.
export interface NodeSummary {
  nodeId: string;
  hostInfo: {
    os: string;
    arch: string;
    dockerVersion: string;
    cpuCount: number;
    totalMemoryMb: number;
  };
  connectedAt: string;
  lastSeenAt: string;
}

export interface ManagedServer {
  id: string;
  nodeId: string;
  templateSlug: string;
  name: string;
  status: ServerStatus;
  config: { env: Record<string, string> };
  createdAt: string;
}

export interface CreateServerInput {
  nodeId: string;
  templateSlug: string;
  name: string;
  env?: Record<string, string>;
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

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
  listServers: () => request<ManagedServer[]>('/servers'),
  getServerLogs: (id: string) => request<string[]>(`/servers/${id}/logs`),
  createServer: (input: CreateServerInput) =>
    request<ManagedServer>('/servers', { method: 'POST', body: JSON.stringify(input) }),
  startServer: (id: string) => request<ManagedServer>(`/servers/${id}/start`, { method: 'POST' }),
  stopServer: (id: string) => request<ManagedServer>(`/servers/${id}/stop`, { method: 'POST' }),
  deleteServer: (id: string) => request<{ deleted: boolean }>(`/servers/${id}`, { method: 'DELETE' }),
};
