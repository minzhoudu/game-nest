import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AGENT_NAMESPACE, PROTOCOL_EVENT } from '@gamenest/shared-types';
import type { AgentToServerMessage, ServerToAgentMessage } from '@gamenest/shared-types';
import { NodeRegistryService } from './node-registry.service';

/**
 * The agent side of the control plane. Agents dial IN to this gateway
 * (see apps/agent's AgentConnectionService) and stay connected; we push
 * commands back down the same socket rather than ever calling out to them.
 */
@WebSocketGateway({ namespace: AGENT_NAMESPACE, cors: { origin: '*' } })
export class NodesGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(NodesGateway.name);

  constructor(
    private readonly registry: NodeRegistryService,
    private readonly config: ConfigService,
  ) {}

  @SubscribeMessage(PROTOCOL_EVENT)
  handleMessage(@ConnectedSocket() client: Socket, @MessageBody() message: AgentToServerMessage): void {
    switch (message.type) {
      case 'agent.register':
        this.handleRegister(client, message);
        return;
      case 'agent.heartbeat':
        this.registry.touchHeartbeat(message.nodeId);
        return;
      case 'container.status':
        // TODO(next phase): persist + relay to the dashboard once servers exist.
        this.logger.log(`server ${message.serverId} -> ${message.status}`);
        return;
      case 'container.log':
        // TODO(next phase): relay to a per-server log stream for the dashboard.
        return;
      case 'command.ack':
        this.logger.debug(`command ${message.requestId} acked`);
        return;
      case 'command.error':
        this.logger.warn(`command ${message.requestId} failed: ${message.message}`);
        return;
      default:
        this.logger.warn(`Unhandled agent message type: ${(message as { type: string }).type}`);
    }
  }

  handleDisconnect(client: Socket): void {
    const nodeId = this.registry.unregisterBySocketId(client.id);
    if (nodeId) {
      this.logger.log(`Node ${nodeId} disconnected`);
    }
  }

  private handleRegister(
    client: Socket,
    message: Extract<AgentToServerMessage, { type: 'agent.register' }>,
  ): void {
    const expectedSecret = this.config.get<string>('AGENT_REGISTRATION_SECRET');

    // MVP auth: one shared secret every agent presents. Fine for "you + friends
    // running your own nodes"; becomes per-node issued tokens once there's a DB
    // and a "register a node" flow in the dashboard (Phase 2/3).
    if (!expectedSecret || message.agentToken !== expectedSecret) {
      this.logger.warn(`Rejected node ${message.nodeId}: invalid agent token`);
      this.send(client, { type: 'agent.registrationFailed', reason: 'Invalid agent token' });
      client.disconnect(true);
      return;
    }

    this.registry.register(message.nodeId, client, message.hostInfo);
    this.logger.log(
      `Node ${message.nodeId} registered (${message.hostInfo.os}/${message.hostInfo.arch}, docker ${message.hostInfo.dockerVersion})`,
    );
    this.send(client, { type: 'agent.registered', nodeId: message.nodeId });
  }

  private send(client: Socket, message: ServerToAgentMessage): void {
    client.emit(PROTOCOL_EVENT, message);
  }
}
