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
} from '@nestjs/common';
import { NodeCommandService } from '../nodes/node-command.service';
import { NodeRegistryService } from '../nodes/node-registry.service';
import { TemplatesService } from '../templates/templates.service';
import type { CreateServerDto } from './dto/create-server.dto';
import { ServersService } from './servers.service';

@Controller('servers')
export class ServersController {
  private readonly logger = new Logger(ServersController.name);

  constructor(
    private readonly servers: ServersService,
    private readonly templates: TemplatesService,
    private readonly commands: NodeCommandService,
    private readonly nodeRegistry: NodeRegistryService,
  ) {}

  @Get()
  list() {
    return this.servers.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.servers.getOrThrow(id);
  }

  @Get(':id/logs')
  logs(@Param('id') id: string) {
    this.servers.getOrThrow(id); // 404s if unknown
    return this.servers.getLogs(id);
  }

  @Post()
  async create(@Body() dto: CreateServerDto) {
    if (!dto.nodeId || !dto.templateSlug || !dto.name) {
      throw new BadRequestException(
        'nodeId, templateSlug, and name are required',
      );
    }
    if (!this.nodeRegistry.getSocket(dto.nodeId)) {
      throw new BadRequestException(`Node ${dto.nodeId} is not connected`);
    }

    const template = this.templates.getBySlug(dto.templateSlug);
    if (!template) {
      throw new NotFoundException(`No template "${dto.templateSlug}"`);
    }

    const env = this.resolveEnv(template.envSchema, dto.env ?? {});
    const server = this.servers.create({
      nodeId: dto.nodeId,
      templateSlug: dto.templateSlug,
      name: dto.name,
      config: { env },
    });

    try {
      await this.commands.send(dto.nodeId, {
        type: 'command.createContainer',
        serverId: server.id,
        dockerImage: template.dockerImage,
        ports: template.ports,
        config: server.config,
      });
      await this.commands.send(dto.nodeId, {
        type: 'command.startContainer',
        serverId: server.id,
      });
    } catch (err) {
      this.servers.remove(server.id);
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

    return this.servers.get(server.id);
  }

  @Post(':id/start')
  async start(@Param('id') id: string) {
    const server = this.servers.getOrThrow(id);
    await this.commands.send(server.nodeId, {
      type: 'command.startContainer',
      serverId: id,
    });
    return this.servers.get(id);
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string) {
    const server = this.servers.getOrThrow(id);
    await this.commands.send(server.nodeId, {
      type: 'command.stopContainer',
      serverId: id,
    });
    return this.servers.get(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const server = this.servers.getOrThrow(id);
    await this.commands.send(server.nodeId, {
      type: 'command.deleteContainer',
      serverId: id,
    });
    this.servers.remove(id);
    return { deleted: true };
  }

  /** Merges the template's env defaults with the caller's overrides, stringified for Docker. */
  private resolveEnv(
    envSchema: {
      key: string;
      default?: string | number | boolean;
      required?: boolean;
    }[],
    overrides: Record<string, string>,
  ): Record<string, string> {
    const env: Record<string, string> = {};
    for (const field of envSchema) {
      const value =
        overrides[field.key] ??
        (field.default !== undefined ? String(field.default) : undefined);
      if (value === undefined) {
        if (field.required)
          throw new BadRequestException(
            `Missing required field "${field.key}"`,
          );
        continue;
      }
      env[field.key] = value;
    }
    return env;
  }
}
