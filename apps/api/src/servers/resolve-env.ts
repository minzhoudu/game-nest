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
    const value = overrides[field.key] ?? defaultToString(field);
    if (value === undefined) {
      if (field.required)
        throw new BadRequestException(`Missing required field "${field.key}"`);
      continue;
    }
    env[field.key] = value;
  }
  return env;
}

/**
 * Stringifies a field's default for Docker. `range` fields store a plain
 * number (e.g. 2, meaning "2 GB") — the actual env value needs the unit
 * appended (e.g. "2G"), matching what CreateServerPage.tsx sends when a
 * user actually moves the slider. Keeping this logic in one place (rather
 * than just relying on the frontend always sending an override) means a
 * range field still resolves correctly even if a caller omits it.
 */
function defaultToString(field: EnvVarSchema): string | undefined {
  if (field.default === undefined) return undefined;
  if (field.type === 'range' && field.unit)
    return `${field.default}${field.unit}`;
  return String(field.default);
}
