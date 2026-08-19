import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ServerStatus } from '@gamenest/shared-types';
import type {
  GameServerConfig,
  Id,
  ServerSummary,
} from '@gamenest/shared-types';
import type {
  GameServer as GameServerRow,
  GameTemplate as GameTemplateRow,
  Prisma,
} from '@prisma/client';
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
import { PrismaService } from '../prisma/prisma.service';

const MAX_LOG_LINES = 200;

type RowWithTemplate = GameServerRow & { template: GameTemplateRow };

/**
 * Prisma-backed — GameServer rows are the durable source of truth, scoped
 * per-owner (see getOwnedOrThrow). Logs stay in-memory only (getLogs/
 * handleLog below): ephemeral operational scrollback, not core state worth
 * a table — see PLANNER.md.
 */
@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);
  private readonly logs = new Map<Id, string[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(input: {
    ownerId: Id;
    nodeId: Id;
    templateId: Id;
    name: string;
    config: GameServerConfig;
  }): Promise<ServerSummary> {
    const row = await this.prisma.gameServer.create({
      data: {
        ownerId: input.ownerId,
        nodeId: input.nodeId,
        templateId: input.templateId,
        name: input.name,
        status: ServerStatus.CREATING,
        config: input.config as unknown as Prisma.InputJsonValue,
      },
      include: { template: true },
    });

    const server = fromRow(row);
    this.events.emit(SERVER_CREATED, { server, ownerId: input.ownerId });
    return server;
  }

  listForOwner(ownerId: Id): Promise<ServerSummary[]> {
    return this.prisma.gameServer
      .findMany({
        where: { ownerId },
        include: { template: true },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map(fromRow));
  }

  /** Scoped to the requesting owner — a mismatched id is indistinguishable from a missing one. */
  async getOwnedOrThrow(id: Id, ownerId: Id): Promise<ServerSummary> {
    const row = await this.prisma.gameServer.findFirst({
      where: { id, ownerId },
      include: { template: true },
    });
    if (!row) throw new NotFoundException(`No server ${id}`);
    return fromRow(row);
  }

  /** For DashboardGateway to route a broadcast to the right socket room — not exposed over the wire. */
  async getOwnerId(id: Id): Promise<Id | undefined> {
    const row = await this.prisma.gameServer.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    return row?.ownerId;
  }

  getLogs(id: Id): string[] {
    return this.logs.get(id) ?? [];
  }

  /** Scoped the same way as getOwnedOrThrow — throws if this isn't the caller's server. */
  async remove(id: Id, ownerId: Id): Promise<void> {
    await this.getOwnedOrThrow(id, ownerId);
    await this.prisma.gameServer.delete({ where: { id } });
    this.logs.delete(id);
    this.events.emit(SERVER_REMOVED, { serverId: id, ownerId });
  }

  @OnEvent(AGENT_CONTAINER_STATUS)
  private async handleStatus(event: AgentContainerStatusEvent): Promise<void> {
    try {
      await this.prisma.gameServer.update({
        where: { id: event.serverId },
        data: { status: event.status },
      });
      this.logger.log(`server ${event.serverId} -> ${event.status}`);
    } catch {
      // Row doesn't exist (already deleted) — a status update for a server we no longer track. Ignore.
    }
  }

  @OnEvent(AGENT_CONTAINER_LOG)
  private handleLog(event: AgentContainerLogEvent): void {
    // No existence check here (unlike before Prisma) — a DB round-trip per
    // log line would be wasteful at this frequency. remove() clears this
    // map on delete; the agent stops emitting for a gone container anyway,
    // so a stray line or two after deletion is a non-issue in practice.
    const lines = this.logs.get(event.serverId) ?? [];
    lines.push(event.line);
    if (lines.length > MAX_LOG_LINES) lines.shift();
    this.logs.set(event.serverId, lines);
  }
}

function fromRow(row: RowWithTemplate): ServerSummary {
  return {
    id: row.id,
    nodeId: row.nodeId,
    templateSlug: row.template.slug,
    name: row.name,
    status: row.status as ServerStatus,
    config: row.config as unknown as GameServerConfig,
    createdAt: row.createdAt.toISOString(),
  };
}
