import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameTemplate as GameTemplateRow, Prisma } from '@prisma/client';
import type {
  EnvVarSchema,
  GameTemplate,
  PortMapping,
} from '@gamenest/shared-types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Template *definitions* still live in code — there's one game so far and
 * it rarely changes — but get upserted into Postgres on every boot, so
 * GameServer.templateId is a real FK instead of a dangling string, and the
 * two never drift out of sync. Adding a template = adding an entry here;
 * no separate seed command to remember to run.
 */
const TEMPLATE_DEFINITIONS: Omit<GameTemplate, 'id'>[] = [
  {
    slug: 'minecraft-java',
    name: 'Minecraft (Java Edition)',
    dockerImage: 'itzg/minecraft-server:latest',
    ports: [{ containerPort: 25565, protocol: 'tcp', label: 'Game port' }],
    envSchema: [
      {
        key: 'EULA',
        label: 'Accept the Mojang EULA',
        type: 'boolean',
        default: true,
        required: true,
      },
      {
        key: 'VERSION',
        label: 'Minecraft version',
        type: 'string',
        default: 'LATEST',
      },
      { key: 'MEMORY', label: 'Memory limit', type: 'string', default: '2G' },
      {
        key: 'DIFFICULTY',
        label: 'Difficulty',
        type: 'string',
        default: 'normal',
      },
    ],
  },
];

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const template of TEMPLATE_DEFINITIONS) {
      const data = {
        name: template.name,
        dockerImage: template.dockerImage,
        ports: template.ports as unknown as Prisma.InputJsonValue,
        envSchema: template.envSchema as unknown as Prisma.InputJsonValue,
      };
      await this.prisma.gameTemplate.upsert({
        where: { slug: template.slug },
        create: { slug: template.slug, ...data },
        update: data,
      });
    }
  }

  async list(): Promise<GameTemplate[]> {
    const rows = await this.prisma.gameTemplate.findMany();
    return rows.map(fromRow);
  }

  async getBySlug(slug: string): Promise<GameTemplate | undefined> {
    const row = await this.prisma.gameTemplate.findUnique({ where: { slug } });
    return row ? fromRow(row) : undefined;
  }
}

function fromRow(row: GameTemplateRow): GameTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    dockerImage: row.dockerImage,
    ports: row.ports as unknown as PortMapping[],
    envSchema: row.envSchema as unknown as EnvVarSchema[],
    volumeMounts:
      (row.volumeMounts as unknown as
        { containerPath: string; label: string }[] | null) ?? undefined,
  };
}
