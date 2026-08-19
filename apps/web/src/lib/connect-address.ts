import type { ServerSummary } from '@gamenest/shared-types';
import { API_URL } from '../api/client';

/**
 * Best-effort "host:port" to hand to a game client. `server.ports[0].hostPort`
 * is the actual port PortAllocatorService assigned this server on its node —
 * no longer just the template's default, now that servers can share a node's
 * port range. The host part is still approximated from the hostname the
 * dashboard itself reaches api through, which is only actually correct when
 * the node is the same machine as api (true for local dev / "you" running
 * your own agent, which is the only case that exists today). Revisit once
 * nodes can be remote — a node will need to report its own reachable address
 * explicitly.
 */
export function connectAddress(server: ServerSummary): string | null {
  const port = server.ports[0];
  if (!port) return null;

  const host = new URL(API_URL).hostname;
  return `${host}:${port.hostPort}`;
}
