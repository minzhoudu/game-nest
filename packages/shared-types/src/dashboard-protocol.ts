// The WebSocket protocol between api and the web dashboard. One-directional
// push from api -> browser only — the dashboard still sends actions
// (create/start/stop/delete a server) through the plain REST API; this
// channel exists purely so the UI reflects node/server/log state changes as
// they happen instead of polling for them.
//
// NodeSummary/ServerSummary are also what GET /nodes and GET /servers
// return over REST — one shape, used both for the initial snapshot and for
// every REST response, so the dashboard never has to reconcile two
// different ideas of what a "node" or "server" looks like.

import type { GameServerConfig, Id, PortBinding, ServerStatus } from './entities.js';
import type { HostInfo } from './agent-protocol.js';

export interface NodeSummary {
  nodeId: Id;
  hostInfo: HostInfo;
  connectedAt: string;
  lastSeenAt: string;
}

export interface ServerSummary {
  id: Id;
  nodeId: Id;
  templateSlug: string;
  name: string;
  status: ServerStatus;
  config: GameServerConfig;
  /** Host ports actually assigned to this server on its node — see PortBinding. */
  ports: PortBinding[];
  createdAt: string;
}

/** Sent once, right after a dashboard client connects — seeds its cache with current state. */
export interface DashboardSnapshot {
  type: 'dashboard.snapshot';
  nodes: NodeSummary[];
  servers: ServerSummary[];
}

export type DashboardEvent =
  | DashboardSnapshot
  | { type: 'node.connected'; node: NodeSummary }
  | { type: 'node.disconnected'; nodeId: Id }
  | { type: 'server.created'; server: ServerSummary }
  | { type: 'server.status'; serverId: Id; status: ServerStatus }
  | { type: 'server.removed'; serverId: Id }
  | { type: 'server.log'; serverId: Id; line: string; timestamp: string };

/** Socket.IO event name the dashboard channel uses to carry the envelope above. */
export const DASHBOARD_EVENT = 'dashboard.event';

/** Namespace the web dashboard connects to on the control plane's WS server. */
export const DASHBOARD_NAMESPACE = '/dashboard';
