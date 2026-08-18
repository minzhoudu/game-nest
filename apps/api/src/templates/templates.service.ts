import { Injectable } from '@nestjs/common';
import type { GameTemplate } from '@gamenest/shared-types';

/**
 * Hardcoded for now — no GameTemplate table yet. Templates rarely change and
 * there's only one so far, so a real table isn't earning its keep until we
 * add a second game and/or let templates be edited without a redeploy.
 */
const TEMPLATES: GameTemplate[] = [
  {
    id: 'minecraft-java',
    slug: 'minecraft-java',
    name: 'Minecraft (Java Edition)',
    dockerImage: 'itzg/minecraft-server:latest',
    ports: [{ containerPort: 25565, protocol: 'tcp', label: 'Game port' }],
    envSchema: [
      { key: 'EULA', label: 'Accept the Mojang EULA', type: 'boolean', default: true, required: true },
      { key: 'VERSION', label: 'Minecraft version', type: 'string', default: 'LATEST' },
      { key: 'MEMORY', label: 'Memory limit', type: 'string', default: '2G' },
      { key: 'DIFFICULTY', label: 'Difficulty', type: 'string', default: 'normal' },
    ],
  },
];

@Injectable()
export class TemplatesService {
  list(): GameTemplate[] {
    return TEMPLATES;
  }

  getBySlug(slug: string): GameTemplate | undefined {
    return TEMPLATES.find((t) => t.slug === slug);
  }
}
