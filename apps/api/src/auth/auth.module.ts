import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { googleOAuthClientProvider } from './google-oauth-client.provider';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    // global:true makes JwtService injectable anywhere (DashboardGateway
    // needs it too, to verify the token on a WS handshake — not an HTTP
    // request, so JwtAuthGuard itself doesn't apply there).
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // @nestjs/jwt types expiresIn against `ms`'s branded StringValue
          // literal type, not a plain string — a runtime value like "7d"
          // read from env is valid but can't be typed that precisely here.
          expiresIn: config.get<string>(
            'JWT_EXPIRES_IN',
            '7d',
          ) as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, googleOAuthClientProvider],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
