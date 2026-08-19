import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { GOOGLE_OAUTH_CLIENT } from './google-oauth-client.provider';

const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  private readonly googleClientId: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
    // Injected (rather than `new OAuth2Client(...)`'d in here) purely so
    // tests can pass a plain `{ verifyIdToken: jest.fn() }` mock, matching
    // how every other dependency in this service is tested — no
    // `jest.mock('google-auth-library')` module magic needed.
    @Inject(GOOGLE_OAUTH_CLIENT) private readonly googleClient: OAuth2Client,
  ) {
    this.googleClientId = config.get<string>('GOOGLE_CLIENT_ID');
  }

  async register(emailInput: string, password: string): Promise<AuthResult> {
    const email = normalizeEmail(emailInput);
    validateCredentials(email, password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Distinct message when the account exists but has no password to set
      // one against (a Google-only signup) — "wrong email" would be
      // confusing here, since the email IS right, just not the method.
      // This does reveal the email is registered, same as the generic
      // duplicate-email case just below — register() has never tried to
      // hide that (unlike login(), see the no-enumeration comment there).
      if (!existing.passwordHash) {
        throw new BadRequestException(
          'That email already has an account via Google sign-in — use "Sign in with Google" instead.',
        );
      }
      throw new BadRequestException(
        'An account with that email already exists',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });
    return this.issueToken(user.id, user.email);
  }

  async login(emailInput: string, password: string): Promise<AuthResult> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same error every way it can fail — unknown email, wrong password, or
    // a Google-only account with no password to check — so the response
    // shape never tells an attacker which emails have accounts (unlike
    // register(), this endpoint keeps that property; see its comment).
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueToken(user.id, user.email);
  }

  /**
   * Verifies a Google Identity Services ID token server-side (never trust
   * one just because the browser sent it) and either logs in an existing
   * Google-linked user, links Google onto an existing password account
   * matched by verified email, or creates a brand-new Google-only account.
   */
  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    if (!this.googleClientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    if (!idToken) {
      throw new BadRequestException('idToken is required');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google credential');
    }
    // Google itself vouches for the email's ownership via this claim — if
    // it's ever false, don't use it to link/create an account by email.
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const googleId = payload.sub;
    const email = normalizeEmail(payload.email);

    const byGoogleId = await this.prisma.user.findUnique({
      where: { googleId },
    });
    if (byGoogleId) return this.issueToken(byGoogleId.id, byGoogleId.email);

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      // Existing password account, first time using Google — link rather
      // than create a second account, since the email's ownership is
      // confirmed by Google (email_verified check above).
      const linked = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId },
      });
      return this.issueToken(linked.id, linked.email);
    }

    const created = await this.prisma.user.create({
      data: { email, googleId },
    });
    return this.issueToken(created.id, created.email);
  }

  private issueToken(id: string, email: string): AuthResult {
    const accessToken = this.jwt.sign({ sub: id, email });
    return { accessToken, user: { id, email } };
  }
}

function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

function validateCredentials(email: string, password: string): void {
  if (!EMAIL_RE.test(email)) {
    throw new BadRequestException('A valid email is required');
  }
  if (!password || password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
}
