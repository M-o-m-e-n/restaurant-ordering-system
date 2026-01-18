import { AuthService } from '../../src/services/auth.service';
import { BadRequestError, UnauthorizedError } from '../../src/utils/errors';

jest.mock('../../src/config/database', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return { __esModule: true, default: prisma };
});

jest.mock('../../src/config/redis', () => {
  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };
  return { __esModule: true, default: redis };
});

jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => 'hashed-password'),
    verify: jest.fn(async () => true),
  },
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    sign: jest.fn(() => 'jwt-token'),
    verify: jest.fn(() => ({ userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' })),
    JsonWebTokenError: class JsonWebTokenError extends Error {},
    TokenExpiredError: class TokenExpiredError extends Error {},
  },
}));

import prisma from '../../src/config/database';
import redis from '../../src/config/redis';

describe('AuthService security hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generateTokens stores refresh tokens as tokenHash (not raw token)', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: 'hashed',
      name: 'A',
      phone: null,
      role: 'CUSTOMER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AuthService();
    await service.register({ email: 'a@b.com', password: 'Password1', name: 'A' });

    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    const args = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0];
    expect(args.data.tokenHash).toBeTruthy();
    expect(args.data.token).toBeUndefined();
  });

  test('refreshToken looks up by tokenHash (and supports legacy token)', async () => {
    (prisma.refreshToken.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // legacy token lookup
      .mockResolvedValueOnce({
        id: 'rt1',
        token: null,
        tokenHash: 'hash',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: 'hashed',
      name: 'A',
      phone: null,
      role: 'CUSTOMER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new AuthService();
    await service.refreshToken('refresh.jwt.token');

    expect(prisma.refreshToken.findFirst).toHaveBeenCalledTimes(2);
  });

  test('forgotPassword rate limits OTP requests per email (silent)', async () => {
    (redis.incr as jest.Mock).mockResolvedValue(4); // over limit
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });

    const service = new AuthService();
    const result = await service.forgotPassword('a@b.com');

    expect(result.message).toMatch(/If the email exists/i);
    expect(redis.setex).not.toHaveBeenCalled();
  });

  test('resetPassword blocks after too many OTP attempts', async () => {
    (redis.incr as jest.Mock).mockResolvedValue(6);

    const service = new AuthService();

    await expect(service.resetPassword('a@b.com', '000000', 'Password1')).rejects.toBeInstanceOf(
      BadRequestError
    );
    await expect(service.resetPassword('a@b.com', '000000', 'Password1')).rejects.toMatchObject({
      message: expect.stringMatching(/Too many OTP attempts/i),
    });
  });

  test('refreshToken throws UnauthorizedError when not found', async () => {
    (prisma.refreshToken.findFirst as jest.Mock).mockResolvedValue(null);

    const service = new AuthService();
    await expect(service.refreshToken('nope')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
