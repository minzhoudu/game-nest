import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AGENT_NAMESPACE, PROTOCOL_EVENT } from '@gamenest/shared-types';
import type {
  AgentToServerMessage,
  ServerToAgentMessage,
} from '@gamenest/shared-types';
import {
  AGENT_COMMAND_ACK,
  AGENT_COMMAND_ERROR,
  AGENT_CONTAINER_LOG,
  AGENT_CONTAINER_STATUS,
  NODE_CONNECTED,
  NODE_DISCONNECTED,
} from '../events/internal-events';
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
    private readonly events: EventEmitter2,
  ) {}

  @SubscribeMessage(PROTOCOL_EVENT)
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: AgentToServerMessage,
  ): void {
    switch (message.type) {
      case 'agent.register':
        this.handleRegister(client, message);
        return;
      case 'agent.heartbeat':
        this.registry.touchHeartbeat(message.nodeId);
        return;
      case 'container.status':
        this.events.emit(AGENT_CONTAINER_STATUS, {
          serverId: message.serverId,
          status: message.status,
        });
        return;
      case 'container.log':
        this.events.emit(AGENT_CONTAINER_LOG, {
          serverId: message.serverId,
          line: message.line,
          timestamp: message.timestamp,
        });
        return;
      case 'command.ack':
        this.events.emit(AGENT_COMMAND_ACK, { requestId: message.requestId });
        return;
      case 'command.error':
        this.events.emit(AGENT_COMMAND_ERROR, {
          requestId: message.requestId,
          message: message.message,
        });
        return;
      default:
        this.logger.warn(
          `Unhandled agent message type: ${(message as { type: string }).type}`,
        );
    }
  }

  handleDisconnect(client: Socket): void {
    const nodeId = this.registry.unregisterBySocketId(client.id);
    if (nodeId) {
      this.logger.log(`Node ${nodeId} disconnected`);
      this.events.emit(NODE_DISCONNECTED, { nodeId });
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
      this.send(client, {
        type: 'agent.registrationFailed',
        reason: 'Invalid agent token',
      });
      client.disconnect(true);
      return;
    }

    const node = this.registry.register(
      message.nodeId,
      client,
      message.hostInfo,
    );
    this.logger.log(
      `Node ${message.nodeId} registered (${message.hostInfo.os}/${message.hostInfo.arch}, docker ${message.hostInfo.dockerVersion})`,
    );
    this.events.emit(NODE_CONNECTED, node);
    this.send(client, { type: 'agent.registered', nodeId: message.nodeId });
  }

  private send(client: Socket, message: ServerToAgentMessage): void {
    client.emit(PROTOCOL_EVENT, message);
  }
}
