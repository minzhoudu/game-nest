import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(emailInput: string, password: string): Promise<AuthResult> {
    const email = normalizeEmail(emailInput);
    validateCredentials(email, password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new BadRequestException(
        'An account with that email already exists',
      );

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });
    return this.issueToken(user.id, user.email);
  }

  async login(emailInput: string, password: string): Promise<AuthResult> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same error either way (unknown email vs. wrong password) — don't let
    // the response shape tell an attacker which emails have accounts.
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueToken(user.id, user.email);
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
