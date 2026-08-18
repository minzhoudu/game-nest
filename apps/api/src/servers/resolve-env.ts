import { BadRequestException } from '@nestjs/common';
import type { EnvVarSchema } from '@gamenest/shared-types';

/**
 * Merges a template's env defaults with the caller's overrides, stringified
 * for Docker (container env vars are always strings). Pulled out of
 * ServersController as a standalone function so it's testable without a
 * Nest testing module — it's pure and has no dependencies beyond its inputs.
 */
export function resolveEnv(
  envSchema: EnvVarSchema[],
  overrides: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const field of envSchema) {
    const value =
      overrides[field.key] ??
      (field.default !== undefined ? String(field.default) : undefined);
    if (value === undefined) {
      if (field.required)
        throw new BadRequestException(`Missing required field "${field.key}"`);
      continue;
    }
    env[field.key] = value;
  }
  return env;
}
