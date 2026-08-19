import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NodeCommandService } from '../nodes/node-command.service';
import { NodeRegistryService } from '../nodes/node-registry.service';
import { TemplatesService } from '../templates/templates.service';
import type { CreateServerDto } from './dto/create-server.dto';
import { PortAllocatorService } from './port-allocator.service';
import { resolveEnv } from './resolve-env';
import { ServersService } from './servers.service';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServersController {
  private readonly logger = new Logger(ServersController.name);

  constructor(
    private readonly servers: ServersService,
    private readonly templates: TemplatesService,
    private readonly commands: NodeCommandService,
    private readonly nodeRegistry: NodeRegistryService,
    private readonly portAllocator: PortAllocatorService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.servers.listForOwner(user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servers.getOwnedOrThrow(id, user.id);
  }

  @Get(':id/logs')
  async logs(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.servers.getOwnedOrThrow(id, user.id); // 404s if unknown or not yours
    return this.servers.getLogs(id);
  }

  @Post()
  async create(
    @Body() dto: CreateServerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!dto.nodeId || !dto.templateSlug || !dto.name) {
      throw new BadRequestException(
        'nodeId, templateSlug, and name are required',
      );
    }
    if (!this.nodeRegistry.getSocket(dto.nodeId)) {
      throw new BadRequestException(`Node ${dto.nodeId} is not connected`);
    }

    const template = await this.templates.getBySlug(dto.templateSlug);
    if (!template) {
      throw new NotFoundException(`No template "${dto.templateSlug}"`);
    }

    const env = resolveEnv(template.envSchema, dto.env ?? {});
    // Allocate host ports before creating the DB row — if the node's range
    // is exhausted this throws and nothing gets created at all, rather than
    // leaving a "creating" row with nowhere to actually bind.
    const ports = await this.portAllocator.allocate(dto.nodeId, template.ports);
    const server = await this.servers.create({
      ownerId: user.id,
      nodeId: dto.nodeId,
      templateId: template.id,
      name: dto.name,
      config: { env },
      ports,
    });

    try {
      await this.commands.send(dto.nodeId, {
        type: 'command.createContainer',
        serverId: server.id,
        dockerImage: template.dockerImage,
        ports: server.ports,
        config: server.config,
      });
      await this.commands.send(dto.nodeId, {
        type: 'command.startContainer',
        serverId: server.id,
      });
    } catch (err) {
      // createContainer may have already succeeded even though the overall
      // sequence failed (e.g. startContainer hit a port conflict) — that
      // would otherwise leave an orphaned, never-started container sitting
      // on the node forever. Best-effort cleanup; swallow a failure here,
      // since there's nothing more we can do and it would only mask the
      // original error.
      await this.commands
        .send(dto.nodeId, {
          type: 'command.deleteContainer',
          serverId: server.id,
        })
        .catch(() => undefined);
      await this.servers.remove(server.id, user.id);
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    }

    // Fire-and-forget: the ack just means "the agent started tailing", not
    // "the stream ended" — container.log events keep arriving after this
    // resolves, for as long as the container runs.
    void this.commands
      .send(dto.nodeId, {
        type: 'command.streamLogs',
        serverId: server.id,
        follow: true,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to start log streaming for ${server.id}: ${message}`,
        );
      });

    return server;
  }

  @Post(':id/start')
  async start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const server = await this.servers.getOwnedOrThrow(id, user.id);
    await this.commands.send(server.nodeId, {
      type: 'command.startContainer',
      serverId: id,
    });
    return this.servers.getOwnedOrThrow(id, user.id);
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const server = await this.servers.getOwnedOrThrow(id, user.id);
    await this.commands.send(server.nodeId, {
      type: 'command.stopContainer',
      serverId: id,
    });
    return this.servers.getOwnedOrThrow(id, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const server = await this.servers.getOwnedOrThrow(id, user.id);
    await this.commands.send(server.nodeId, {
      type: 'command.deleteContainer',
      serverId: id,
    });
    await this.servers.remove(id, user.id);
    return { deleted: true };
  }
}
