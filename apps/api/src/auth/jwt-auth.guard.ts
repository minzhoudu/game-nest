import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Hand-rolled rather than @nestjs/passport + passport-jwt — the app only
 * ever needs one check (valid bearer token -> req.user), so pulling in a
 * full strategy-based framework for that is more machinery than the problem
 * needs. Reused by DashboardGateway too (see verifyToken export) for the
 * WS handshake, since that isn't an HTTP request the guard can attach to.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const user = await verifyToken(this.jwt, token);
    if (!user) throw new UnauthorizedException('Invalid or expired token');

    request.user = user;
    return true;
  }
}

export function extractBearerToken(
  header: string | undefined,
): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

export async function verifyToken(
  jwt: JwtService,
  token: string,
): Promise<AuthenticatedUser | undefined> {
  try {
    const payload = await jwt.verifyAsync<JwtPayload>(token);
    return { id: payload.sub, email: payload.email };
  } catch {
    return undefined;
  }
}
