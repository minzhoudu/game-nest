import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DASHBOARD_EVENT, DASHBOARD_NAMESPACE } from '@gamenest/shared-types';
import type { DashboardEvent, DashboardSnapshot } from '@gamenest/shared-types';
import { verifyToken } from '../auth/jwt-auth.guard';
import {
  AGENT_CONTAINER_LOG,
  AGENT_CONTAINER_STATUS,
  NODE_CONNECTED,
  NODE_DISCONNECTED,
  SERVER_CREATED,
  SERVER_REMOVED,
} from '../events/internal-events';
import type {
  AgentContainerLogEvent,
  AgentContainerStatusEvent,
  NodeConnectedEvent,
  NodeDisconnectedEvent,
  ServerCreatedEvent,
  ServerRemovedEvent,
} from '../events/internal-events';
import { NodeRegistryService } from '../nodes/node-registry.service';
import { ServersService } from '../servers/servers.service';

/**
 * Push-only channel for the web dashboard: a client connects (authenticated
 * — see handleConnection), gets one snapshot of current state, then
 * receives incremental events as they happen — no polling. The dashboard
 * still sends actions (create/start/stop/delete a server) through the plain
 * REST API; this gateway never receives messages from clients.
 *
 * Nodes are shared infrastructure (visible to every logged-in user, not
 * owned) so node-connected/disconnected events broadcast to everyone.
 * Servers are owned — each authenticated socket joins a room named after
 * its user id, and server-created/status/removed/log events are routed
 * with `.to(ownerId)` instead of a blanket broadcast, so nobody sees
 * another user's servers over this channel even though they all share the
 * same gateway.
 */
@WebSocketGateway({ namespace: DASHBOARD_NAMESPACE, cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DashboardGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly nodeRegistry: NodeRegistryService,
    private readonly servers: ServersService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    const user = token ? await verifyToken(this.jwt, token) : undefined;
    if (!user) {
      this.logger.warn(`Rejected dashboard connection: missing/invalid token`);
      client.disconnect(true);
      return;
    }

    await client.join(user.id);

    const snapshot: DashboardSnapshot = {
      type: 'dashboard.snapshot',
      nodes: this.nodeRegistry.list(),
      servers: await this.servers.listForOwner(user.id),
    };
    client.emit(DASHBOARD_EVENT, snapshot);
  }

  @OnEvent(NODE_CONNECTED)
  private onNodeConnected(node: NodeConnectedEvent): void {
    this.broadcastAll({ type: 'node.connected', node });
  }

  @OnEvent(NODE_DISCONNECTED)
  private onNodeDisconnected(event: NodeDisconnectedEvent): void {
    this.broadcastAll({ type: 'node.disconnected', nodeId: event.nodeId });
  }

  @OnEvent(SERVER_CREATED)
  private onServerCreated(event: ServerCreatedEvent): void {
    this.broadcastTo(event.ownerId, {
      type: 'server.created',
      server: event.server,
    });
  }

  @OnEvent(AGENT_CONTAINER_STATUS)
  private async onServerStatus(
    event: AgentContainerStatusEvent,
  ): Promise<void> {
    const ownerId = await this.servers.getOwnerId(event.serverId);
    if (!ownerId) return;
    this.broadcastTo(ownerId, {
      type: 'server.status',
      serverId: event.serverId,
      status: event.status,
    });
  }

  @OnEvent(SERVER_REMOVED)
  private onServerRemoved(event: ServerRemovedEvent): void {
    this.broadcastTo(event.ownerId, {
      type: 'server.removed',
      serverId: event.serverId,
    });
  }

  @OnEvent(AGENT_CONTAINER_LOG)
  private async onServerLog(event: AgentContainerLogEvent): Promise<void> {
    const ownerId = await this.servers.getOwnerId(event.serverId);
    if (!ownerId) return;
    this.broadcastTo(ownerId, {
      type: 'server.log',
      serverId: event.serverId,
      line: event.line,
      timestamp: event.timestamp,
    });
  }

  private broadcastAll(event: DashboardEvent): void {
    this.server.emit(DASHBOARD_EVENT, event);
  }

  private broadcastTo(ownerId: string, event: DashboardEvent): void {
    this.server.to(ownerId).emit(DASHBOARD_EVENT, event);
  }
}
