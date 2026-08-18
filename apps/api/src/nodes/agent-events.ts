import type { Id, ServerStatus } from '@gamenest/shared-types';

// Internal event names NodesGateway emits when an agent message doesn't need
// registry/auth logic itself — decouples the gateway from ServersModule
// (which would otherwise need to import NodesModule and vice versa).

export const AGENT_COMMAND_ACK = 'agent.command.ack';
export const AGENT_COMMAND_ERROR = 'agent.command.error';
export const AGENT_CONTAINER_STATUS = 'agent.container.status';
export const AGENT_CONTAINER_LOG = 'agent.container.log';

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
