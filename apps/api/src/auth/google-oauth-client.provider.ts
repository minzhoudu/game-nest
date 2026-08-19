import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

/**
 * DI token for the real OAuth2Client — kept separate from AuthService so it
 * can be constructed once from config and swapped for a plain mock in tests
 * (see auth.service.spec.ts), the same pattern used for Prisma/Jwt there.
 */
export const GOOGLE_OAUTH_CLIENT = 'GOOGLE_OAUTH_CLIENT';

export const googleOAuthClientProvider: Provider = {
  provide: GOOGLE_OAUTH_CLIENT,
  useFactory: (config: ConfigService) =>
    new OAuth2Client(config.get<string>('GOOGLE_CLIENT_ID')),
  inject: [ConfigService],
};
