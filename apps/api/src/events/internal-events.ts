import type {
  Id,
  NodeSummary,
  ServerStatus,
  ServerSummary,
} from '@gamenest/shared-types';

// In-process event bus (via @nestjs/event-emitter) used to decouple modules
// that would otherwise need to import each other. NodesGateway (owns the
// agent socket) needs ServersService to update and DashboardGateway to push
// to browsers, but neither of those needs to import NodesModule back — they
// just listen for these events instead.

export const AGENT_COMMAND_ACK = 'agent.command.ack';
export const AGENT_COMMAND_ERROR = 'agent.command.error';
export const AGENT_CONTAINER_STATUS = 'agent.container.status';
export const AGENT_CONTAINER_LOG = 'agent.container.log';
export const NODE_CONNECTED = 'node.connected';
export const NODE_DISCONNECTED = 'node.disconnected';
export const SERVER_CREATED = 'server.created';
export const SERVER_REMOVED = 'server.removed';

export interface AgentCommandAckEvent {
  requestId: Id;
}

export interface AgentCommandErrorEvent {
  requestId: Id;
  message: string;
}

export interface AgentContainerStatusEvent {
  serverId: Id;
  status: ServerStatus;
}

export interface AgentContainerLogEvent {
  serverId: Id;
  line: string;
  timestamp: string;
}

/** NodeSummary itself — no wrapper needed, a "connected" event just is the summary. */
export type NodeConnectedEvent = NodeSummary;

export interface NodeDisconnectedEvent {
  nodeId: Id;
}

export interface ServerCreatedEvent {
  server: ServerSummary;
}

export interface ServerRemovedEvent {
  serverId: Id;
}
