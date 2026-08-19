import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { DASHBOARD_EVENT, DASHBOARD_NAMESPACE } from '@gamenest/shared-types';
import type { DashboardEvent, NodeSummary, ServerSummary } from '@gamenest/shared-types';
import { useAuth } from './useAuth';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

/**
 * Connects once (per token) to api's dashboard push channel and keeps the
 * React Query cache for ['nodes'] / ['servers'] / ['server-logs', id] in
 * sync as events arrive — this is what lets the rest of the app not poll.
 * Mounted in Layout, so only runs for an authenticated session.
 *
 * The gateway requires auth on connect (DashboardGateway.handleConnection)
 * and only sends server.* events for servers this token's user owns — see
 * that file for why. On (re)connect the server always sends a fresh
 * dashboard.snapshot first, so a dropped connection self-heals without any
 * extra logic here — socket.io's own reconnection handles it.
 */
export function useDashboardSocket(): void {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const socket = io(`${API_URL}${DASHBOARD_NAMESPACE}`, {
      reconnection: true,
      reconnectionDelay: 2000,
      auth: { token },
    });

    socket.on(DASHBOARD_EVENT, (event: DashboardEvent) => {
      switch (event.type) {
        case 'dashboard.snapshot':
          queryClient.setQueryData(['nodes'], event.nodes);
          queryClient.setQueryData(['servers'], event.servers);
          return;

        case 'node.connected':
          queryClient.setQueryData<NodeSummary[]>(['nodes'], (prev = []) => [
            ...prev.filter((n) => n.nodeId !== event.node.nodeId),
            event.node,
          ]);
          return;

        case 'node.disconnected':
          queryClient.setQueryData<NodeSummary[]>(['nodes'], (prev = []) =>
            prev.filter((n) => n.nodeId !== event.nodeId),
          );
          return;

        case 'server.created':
          queryClient.setQueryData<ServerSummary[]>(['servers'], (prev = []) => [
            ...prev.filter((s) => s.id !== event.server.id),
            event.server,
          ]);
          return;

        case 'server.status':
          queryClient.setQueryData<ServerSummary[]>(['servers'], (prev = []) =>
            prev.map((s) => (s.id === event.serverId ? { ...s, status: event.status } : s)),
          );
          return;

        case 'server.removed':
          queryClient.setQueryData<ServerSummary[]>(['servers'], (prev = []) =>
            prev.filter((s) => s.id !== event.serverId),
          );
          return;

        case 'server.log':
          // Only append if that server's log panel has actually been opened
          // (i.e. something already populated this query key) — otherwise
          // every server's logs would accumulate in memory even unwatched.
          queryClient.setQueryData<string[] | undefined>(['server-logs', event.serverId], (prev) =>
            prev === undefined ? prev : [...prev, event.line],
          );
          return;
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, token]);
}
