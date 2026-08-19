import { BadRequestException } from '@nestjs/common';
import type { EnvVarSchema } from '@gamenest/shared-types';
import { resolveEnv } from './resolve-env';

describe('resolveEnv', () => {
  it('fills in defaults, stringified, when no override is given', () => {
    const schema: EnvVarSchema[] = [
      { key: 'VERSION', label: 'Version', type: 'string', default: 'LATEST' },
      { key: 'MEMORY', label: 'Memory', type: 'string', default: '2G' },
    ];

    expect(resolveEnv(schema, {})).toEqual({ VERSION: 'LATEST', MEMORY: '2G' });
  });

  it('lets a caller-supplied override win over the default', () => {
    const schema: EnvVarSchema[] = [
      { key: 'VERSION', label: 'Version', type: 'string', default: 'LATEST' },
    ];

    expect(resolveEnv(schema, { VERSION: '1.21' })).toEqual({
      VERSION: '1.21',
    });
  });

  it('includes a falsy default correctly instead of treating it as missing', () => {
    // Regression guard: `field.default ?? undefined`-style checks would wrongly
    // drop `false`/`0`/`""` defaults. The real implementation checks
    // `!== undefined` specifically to avoid that.
    const schema: EnvVarSchema[] = [
      {
        key: 'ONLINE_MODE',
        label: 'Online mode',
        type: 'boolean',
        default: false,
      },
    ];

    expect(resolveEnv(schema, {})).toEqual({ ONLINE_MODE: 'false' });
  });

  it('omits an optional field with no default and no override', () => {
    const schema: EnvVarSchema[] = [
      { key: 'DIFFICULTY', label: 'Difficulty', type: 'string' },
    ];

    expect(resolveEnv(schema, {})).toEqual({});
  });

  it('throws BadRequestException for a required field with no default and no override', () => {
    const schema: EnvVarSchema[] = [
      { key: 'EULA', label: 'EULA', type: 'boolean', required: true },
    ];

    expect(() => resolveEnv(schema, {})).toThrow(BadRequestException);
  });

  it('does not throw when a required field has a default', () => {
    const schema: EnvVarSchema[] = [
      {
        key: 'EULA',
        label: 'EULA',
        type: 'boolean',
        default: true,
        required: true,
      },
    ];

    expect(resolveEnv(schema, {})).toEqual({ EULA: 'true' });
  });

  it('appends the unit to a range field\'s numeric default (e.g. 2 -> "2G")', () => {
    const schema: EnvVarSchema[] = [
      {
        key: 'MEMORY',
        label: 'Memory',
        type: 'range',
        default: 2,
        min: 1,
        max: 8,
        step: 1,
        unit: 'G',
      },
    ];

    expect(resolveEnv(schema, {})).toEqual({ MEMORY: '2G' });
  });

  it('still lets an override win for a range field, used as-is', () => {
    const schema: EnvVarSchema[] = [
      {
        key: 'MEMORY',
        label: 'Memory',
        type: 'range',
        default: 2,
        min: 1,
        max: 8,
        step: 1,
        unit: 'G',
      },
    ];

    expect(resolveEnv(schema, { MEMORY: '4G' })).toEqual({ MEMORY: '4G' });
  });
});
