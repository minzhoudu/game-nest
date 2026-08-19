import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('creates a user with a hashed (not plaintext) password and returns a token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      let createData: { email: string; passwordHash: string } | undefined;
      prisma.user.create.mockImplementation(
        ({ data }: { data: { email: string; passwordHash: string } }) => {
          createData = data;
          return Promise.resolve({ id: 'u1', ...data });
        },
      );

      const result = await service.register('Test@Example.com', 'password123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(createData?.email).toBe('test@example.com'); // normalized
      expect(createData?.passwordHash).not.toBe('password123');
      await expect(
        bcrypt.compare('password123', createData?.passwordHash ?? ''),
      ).resolves.toBe(true);
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'test@example.com',
      });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: 'u1', email: 'test@example.com' },
      });
    });

    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a malformed email', async () => {
      await expect(
        service.register('not-an-email', 'password123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a password under 8 characters', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.register('test@example.com', 'short'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('returns a token when the password matches', async () => {
      const passwordHash = await bcrypt.hash('password123', 4); // low cost factor — fast test, hash format is the same
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash,
      });

      const result = await service.login('test@example.com', 'password123');

      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: 'u1', email: 'test@example.com' },
      });
    });

    it('rejects an unknown email with the same error as a wrong password (no user enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login('nobody@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash,
      });
      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
