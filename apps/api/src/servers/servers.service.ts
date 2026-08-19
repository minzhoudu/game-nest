import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { ServerStatus } from '@gamenest/shared-types';
import type {
  GameServerConfig,
  Id,
  ServerSummary,
} from '@gamenest/shared-types';
import {
  AGENT_CONTAINER_LOG,
  AGENT_CONTAINER_STATUS,
  SERVER_CREATED,
  SERVER_REMOVED,
} from '../events/internal-events';
import type {
  AgentContainerLogEvent,
  AgentContainerStatusEvent,
} from '../events/internal-events';

const MAX_LOG_LINES = 200;

/**
 * In-memory for now, same as NodeRegistryService — no GameServer table yet.
 * Status/logs are updated reactively as container.status / container.log
 * events arrive from whichever node owns the server (see internal-events.ts).
 * create()/remove() emit their own events so DashboardGateway can push
 * server.created/server.removed to browsers without importing this module.
 */
@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);
  private readonly servers = new Map<Id, ServerSummary>();
  private readonly logs = new Map<Id, string[]>();

  constructor(private readonly events: EventEmitter2) {}

  create(input: {
    nodeId: Id;
    templateSlug: string;
    name: string;
    config: GameServerConfig;
  }): ServerSummary {
    const server: ServerSummary = {
      id: randomUUID(),
      nodeId: input.nodeId,
      templateSlug: input.templateSlug,
      name: input.name,
      status: ServerStatus.CREATING,
      config: input.config,
      createdAt: new Date().toISOString(),
    };
    this.servers.set(server.id, server);
    this.events.emit(SERVER_CREATED, { server });
    return server;
  }

  list(): ServerSummary[] {
    return [...this.servers.values()];
  }

  get(id: Id): ServerSummary | undefined {
    return this.servers.get(id);
  }

  getOrThrow(id: Id): ServerSummary {
    const server = this.get(id);
    if (!server) throw new NotFoundException(`No server ${id}`);
    return server;
  }

  getLogs(id: Id): string[] {
    return this.logs.get(id) ?? [];
  }

  remove(id: Id): void {
    this.servers.delete(id);
    this.logs.delete(id);
    this.events.emit(SERVER_REMOVED, { serverId: id });
  }

  @OnEvent(AGENT_CONTAINER_STATUS)
  private handleStatus(event: AgentContainerStatusEvent): void {
    const server = this.servers.get(event.serverId);
    if (!server) return; // status for a server we don't (or no longer) know about
    server.status = event.status;
    this.logger.log(`server ${server.id} (${server.name}) -> ${event.status}`);
  }

  @OnEvent(AGENT_CONTAINER_LOG)
  private handleLog(event: AgentContainerLogEvent): void {
    if (!this.servers.has(event.serverId)) return;
    const lines = this.logs.get(event.serverId) ?? [];
    lines.push(event.line);
    if (lines.length > MAX_LOG_LINES) lines.shift();
    this.logs.set(event.serverId, lines);
  }
}
