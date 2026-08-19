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
        type: 'select',
        default: 'LATEST',
        description:
          'Latest release always works; pick a specific version to match mods/friends.',
        options: [
          { value: 'LATEST', label: 'Latest release' },
          { value: '1.20.4', label: '1.20.4' },
          { value: '1.19.4', label: '1.19.4' },
          { value: '1.18.2', label: '1.18.2' },
          { value: '1.16.5', label: '1.16.5' },
          { value: '1.12.2', label: '1.12.2' },
        ],
      },
      {
        key: 'MEMORY',
        label: 'Memory limit',
        type: 'range',
        default: 2,
        min: 1,
        max: 8,
        step: 1,
        unit: 'G',
        description:
          'How much RAM the server container gets. Higher = smoother with more players/mods.',
      },
      {
        key: 'DIFFICULTY',
        label: 'Difficulty',
        type: 'select',
        default: 'normal',
        options: [
          { value: 'peaceful', label: 'Peaceful' },
          { value: 'easy', label: 'Easy' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Hard' },
        ],
      },
    ],
  },
  {
    slug: 'seven-days-to-die',
    name: '7 Days to Die',
    // vinanrra/Docker-7DaysToDie (LinuxGSM-based) — actively maintained,
    // verified against its docs before adding this. Unlike itzg's Minecraft
    // image, this one configures gameplay settings (server name, password,
    // difficulty, max players) via serverconfig.xml inside the container,
    // not env vars — so there's no equivalent of Minecraft's DIFFICULTY
    // here. Exposing those would mean writing a config file into a volume
    // at container-create time, which nothing in this app does yet
    // (a real future feature, not in scope now — see PLANNER.md).
    dockerImage: 'vinanrra/7dtd-server:latest',
    ports: [
      { containerPort: 26900, protocol: 'tcp', label: 'Game port (TCP)' },
      { containerPort: 26900, protocol: 'udp', label: 'Game port (UDP)' },
    ],
    envSchema: [
      // 3 = "update server and start" — the one mode that works for both a
      // fresh container (installs first) and a restart, matching how this
      // app always does create+start together. Not a real user choice, so
      // it's hidden from the form and just always sent.
      {
        key: 'START_MODE',
        label: 'Start mode',
        type: 'string',
        default: '3',
        hidden: true,
      },
      {
        key: 'VERSION',
        label: 'Game branch',
        type: 'select',
        default: 'stable',
        options: [
          { value: 'stable', label: 'Stable' },
          { value: 'latest_experimental', label: 'Latest experimental' },
        ],
      },
      {
        key: 'MONITOR',
        label: 'Auto-restart if the server crashes',
        type: 'select',
        default: 'NO',
        options: [
          { value: 'YES', label: 'Yes' },
          { value: 'NO', label: 'No' },
        ],
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
