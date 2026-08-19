// The WebSocket protocol spoken between the Node Agent and the Control Plane.
//
// The agent always dials OUT to the control plane (it may be behind NAT on a
// home PC with no inbound access). The control plane sends Commands down
// that same socket; the agent executes them locally via the Docker daemon
// and reports back with Events. Every message is one JSON object matching
// one of the types below, so both ends can `switch` on `type` with full
// type-safety.

import { GameServerConfig, Id, PortBinding, ServerStatus } from './entities.js';

// ---- Agent -> Control Plane -------------------------------------------

export type AgentToServerMessage =
  | { type: 'agent.register'; nodeId: Id; agentToken: string; hostInfo: HostInfo }
  | { type: 'agent.heartbeat'; nodeId: Id }
  | { type: 'container.status'; requestId?: Id; serverId: Id; status: ServerStatus }
  | { type: 'container.log'; serverId: Id; line: string; timestamp: string }
  | { type: 'command.ack'; requestId: Id }
  | { type: 'command.error'; requestId: Id; message: string };

export interface HostInfo {
  os: string;
  arch: string;
  dockerVersion: string;
  cpuCount: number;
  totalMemoryMb: number;
}

// ---- Control Plane -> Agent --------------------------------------------

export type ServerToAgentMessage =
  | { type: 'agent.registered'; nodeId: Id }
  | { type: 'agent.registrationFailed'; reason: string }
  | {
      type: 'command.createContainer';
      requestId: Id;
      serverId: Id;
      dockerImage: string;
      /** Already-allocated host ports for this server — see PortBinding. */
      ports: PortBinding[];
      config: GameServerConfig;
    }
  | { type: 'command.startContainer'; requestId: Id; serverId: Id }
  | { type: 'command.stopContainer'; requestId: Id; serverId: Id }
  | { type: 'command.deleteContainer'; requestId: Id; serverId: Id }
  | { type: 'command.streamLogs'; requestId: Id; serverId: Id; follow: boolean };

export type AnyProtocolMessage = AgentToServerMessage | ServerToAgentMessage;

/** Socket.IO event name both sides use to exchange the envelope above. */
export const PROTOCOL_EVENT = 'message';

/** Namespace the agent connects to on the control plane's WS server. */
export const AGENT_NAMESPACE = '/agent';
