import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

interface FakeRequest {
  headers: { authorization?: string };
  user?: unknown;
}

function contextWithHeader(authorization?: string): {
  context: ExecutionContext;
  request: FakeRequest;
} {
  const request: FakeRequest = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwt as unknown as JwtService);
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = contextWithHeader(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const { context } = contextWithHeader('Basic abc123');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid or expired token', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context } = contextWithHeader('Bearer bad-token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches req.user and allows the request through for a valid token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'test@example.com' });
    const { context, request } = contextWithHeader('Bearer good-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', email: 'test@example.com' });
  });
});
