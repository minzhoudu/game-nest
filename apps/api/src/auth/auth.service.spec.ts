import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };
  let googleClient: { verifyIdToken: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    config = { get: jest.fn().mockReturnValue('test-google-client-id') };
    googleClient = { verifyIdToken: jest.fn() };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      googleClient as unknown as OAuth2Client,
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
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing',
        passwordHash: 'hash',
      });
      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects with a distinct message when the email belongs to a Google-only account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing',
        passwordHash: null,
      });

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(/Google sign-in/);
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

    it('rejects a Google-only account (no password to check) with the same error as any other failure', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: null,
      });
      await expect(
        service.login('test@example.com', 'whatever'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginWithGoogle', () => {
    function mockPayload(overrides: Record<string, unknown> = {}) {
      return {
        sub: 'google-sub-1',
        email: 'test@example.com',
        email_verified: true,
        ...overrides,
      };
    }

    it('creates a new Google-only account when neither googleId nor email exist yet', async () => {
      googleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload(),
      });
      prisma.user.findUnique.mockResolvedValue(null); // neither lookup finds anyone
      let createData: { email: string; googleId: string } | undefined;
      prisma.user.create.mockImplementation(
        ({ data }: { data: { email: string; googleId: string } }) => {
          createData = data;
          return Promise.resolve({ id: 'u1', ...data });
        },
      );

      const result = await service.loginWithGoogle('valid-id-token');

      expect(googleClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-id-token',
        audience: 'test-google-client-id',
      });
      expect(createData).toEqual({
        email: 'test@example.com',
        googleId: 'google-sub-1',
      });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: 'u1', email: 'test@example.com' },
      });
    });

    it('links Google onto an existing password account matched by verified email, rather than creating a second account', async () => {
      googleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload(),
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // lookup by googleId — no one yet
        .mockResolvedValueOnce({
          id: 'existing-password-user',
          email: 'test@example.com',
          passwordHash: 'some-hash',
        });
      prisma.user.update.mockResolvedValue({
        id: 'existing-password-user',
        email: 'test@example.com',
      });

      const result = await service.loginWithGoogle('valid-id-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'existing-password-user' },
        data: { googleId: 'google-sub-1' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user).toEqual({
        id: 'existing-password-user',
        email: 'test@example.com',
      });
    });

    it('logs in directly when the googleId is already linked, without touching the user row', async () => {
      googleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
      });

      const result = await service.loginWithGoogle('valid-id-token');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user).toEqual({ id: 'u1', email: 'test@example.com' });
    });

    it('rejects when the Google account email is not verified, rather than linking/creating by it', async () => {
      googleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload({ email_verified: false }),
      });

      await expect(service.loginWithGoogle('valid-id-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an invalid/unverifiable token instead of throwing the raw library error', async () => {
      googleClient.verifyIdToken.mockRejectedValue(new Error('bad signature'));

      await expect(service.loginWithGoogle('garbage')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a missing idToken without calling Google at all', async () => {
      await expect(service.loginWithGoogle('')).rejects.toThrow(
        BadRequestException,
      );
      expect(googleClient.verifyIdToken).not.toHaveBeenCalled();
    });

    it('rejects when Google sign-in is not configured (no client id)', async () => {
      config.get.mockReturnValue(undefined);
      const unconfigured = new AuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        config as unknown as ConfigService,
        googleClient as unknown as OAuth2Client,
      );

      await expect(
        unconfigured.loginWithGoogle('valid-id-token'),
      ).rejects.toThrow(BadRequestException);
      expect(googleClient.verifyIdToken).not.toHaveBeenCalled();
    });
  });
});
