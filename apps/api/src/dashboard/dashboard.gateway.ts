import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DASHBOARD_EVENT, DASHBOARD_NAMESPACE } from '@gamenest/shared-types';
import type { DashboardEvent, DashboardSnapshot } from '@gamenest/shared-types';
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
 * Push-only channel for the web dashboard: a client connects, gets one
 * snapshot of current state, then receives incremental events as they
 * happen — no polling. The dashboard still sends actions (create/start/
 * stop/delete a server) through the plain REST API; this gateway never
 * receives messages from clients, only broadcasts to them.
 *
 * Every handler here just re-shapes an internal event (already flowing
 * through @nestjs/event-emitter for other reasons — see internal-events.ts)
 * into the DashboardEvent wire format and broadcasts it. No new state, no
 * new logic — this is purely a relay.
 */
@WebSocketGateway({ namespace: DASHBOARD_NAMESPACE, cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly nodeRegistry: NodeRegistryService,
    private readonly servers: ServersService,
  ) {}

  handleConnection(client: Socket): void {
    const snapshot: DashboardSnapshot = {
      type: 'dashboard.snapshot',
      nodes: this.nodeRegistry.list(),
      servers: this.servers.list(),
    };
    client.emit(DASHBOARD_EVENT, snapshot);
  }

  @OnEvent(NODE_CONNECTED)
  private onNodeConnected(node: NodeConnectedEvent): void {
    this.broadcast({ type: 'node.connected', node });
  }

  @OnEvent(NODE_DISCONNECTED)
  private onNodeDisconnected(event: NodeDisconnectedEvent): void {
    this.broadcast({ type: 'node.disconnected', nodeId: event.nodeId });
  }

  @OnEvent(SERVER_CREATED)
  private onServerCreated(event: ServerCreatedEvent): void {
    this.broadcast({ type: 'server.created', server: event.server });
  }

  @OnEvent(AGENT_CONTAINER_STATUS)
  private onServerStatus(event: AgentContainerStatusEvent): void {
    this.broadcast({
      type: 'server.status',
      serverId: event.serverId,
      status: event.status,
    });
  }

  @OnEvent(SERVER_REMOVED)
  private onServerRemoved(event: ServerRemovedEvent): void {
    this.broadcast({ type: 'server.removed', serverId: event.serverId });
  }

  @OnEvent(AGENT_CONTAINER_LOG)
  private onServerLog(event: AgentContainerLogEvent): void {
    this.broadcast({
      type: 'server.log',
      serverId: event.serverId,
      line: event.line,
      timestamp: event.timestamp,
    });
  }

  private broadcast(event: DashboardEvent): void {
    this.server.emit(DASHBOARD_EVENT, event);
  }
}
