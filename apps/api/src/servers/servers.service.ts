import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { ServerStatus } from '@gamenest/shared-types';
import type { GameServerConfig, Id } from '@gamenest/shared-types';
import { AGENT_CONTAINER_LOG, AGENT_CONTAINER_STATUS } from '../nodes/agent-events';
import type { AgentContainerLogEvent, AgentContainerStatusEvent } from '../nodes/agent-events';

const MAX_LOG_LINES = 200;

export interface ManagedServer {
  id: Id;
  nodeId: Id;
  templateSlug: string;
  name: string;
  status: ServerStatus;
  config: GameServerConfig;
  createdAt: string;
}

/**
 * In-memory for now, same as NodeRegistryService — no GameServer table yet.
 * Status/logs are updated reactively as container.status / container.log
 * events arrive from whichever node owns the server (see agent-events.ts).
 */
@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);
  private readonly servers = new Map<Id, ManagedServer>();
  private readonly logs = new Map<Id, string[]>();

  create(input: { nodeId: Id; templateSlug: string; name: string; config: GameServerConfig }): ManagedServer {
    const server: ManagedServer = {
      id: randomUUID(),
      nodeId: input.nodeId,
      templateSlug: input.templateSlug,
      name: input.name,
      status: ServerStatus.CREATING,
      config: input.config,
      createdAt: new Date().toISOString(),
    };
    this.servers.set(server.id, server);
    return server;
  }

  list(): ManagedServer[] {
    return [...this.servers.values()];
  }

  get(id: Id): ManagedServer | undefined {
    return this.servers.get(id);
  }

  getOrThrow(id: Id): ManagedServer {
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
