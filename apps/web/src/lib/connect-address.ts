import type { GameTemplate, ServerSummary } from '@gamenest/shared-types';
import { API_URL } from '../api/client';

/**
 * Best-effort "host:port" to hand to a game client. Nodes don't carry an IP
 * anywhere yet (HostInfo has os/arch/cpu/memory, not an address) — this
 * approximates using the hostname the dashboard itself reaches api through,
 * which is only actually correct when the node is the same machine as api
 * (true for local dev / "you" running your own agent, which is the only
 * case that exists today). Revisit once nodes can be remote — a node will
 * need to report its own reachable address explicitly.
 */
export function connectAddress(server: ServerSummary, templates: GameTemplate[] | undefined): string | null {
  const template = templates?.find((t) => t.slug === server.templateSlug);
  const port = template?.ports[0];
  if (!port) return null;

  const host = new URL(API_URL).hostname;
  return `${host}:${port.containerPort}`;
}
