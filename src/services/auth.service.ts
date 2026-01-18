import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import prisma from '../config/database';
import redis from '../config/redis';
import config from '../config';
import { logger } from '../config/logger';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError
} from '../utils/errors';
import { generateOTP } from '../utils/helpers';
import { sha256 } from '../utils/crypto';
import type { User, UserRole } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export class AuthService {
  /**
   * Parse a JWT expiresIn-style string (e.g. "15m", "7d") into milliseconds.
   * Falls back to seconds when no unit is provided.
   */
  private parseExpiresInToMs(expiresIn: string): number {
    const raw = String(expiresIn).trim();
    const m = raw.match(/^(\d+)\s*([smhd])?$/i);
    if (!m) {
      throw new Error('Invalid expiresIn format');
    }

    const value = Number(m[1]);
    const unit = (m[2] || 's').toLowerCase();

    const factor: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return value * factor[unit];
  }

  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: UserRole;
  }): Promise<{ user: Partial<User>; tokens: TokenPair }> {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new ConflictError('User with this email or phone already exists');
    }

    // Hash password
    const hashedPassword = await argon2.hash(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        phone: data.phone,
        // Prevent privilege escalation via self-registration
        role: 'CUSTOMER',
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: Partial<User>; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await argon2.verify(user.password, password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  /**
   * Logout user - blacklist token
   */
  async logout(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload & { exp: number };
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await redis.setex(`blacklist:${token}`, ttl, '1');
      }
    } catch (error) {
      logger.debug('Token already expired or invalid during logout');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const refreshTokenHash = sha256(refreshToken);

    // Verify refresh token exists in database.
    // NOTE: In this workspace the Prisma client may not yet include `tokenHash` (migration pending),
    // so we try legacy lookup first and then attempt a best-effort hash lookup.
    let storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken } as any,
    } as any);

    if (!storedToken) {
      try {
        storedToken = await prisma.refreshToken.findFirst({
          where: { tokenHash: refreshTokenHash } as any,
        } as any);
      } catch {
        // ignore - client doesn't have tokenHash yet
      }
    }

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedError('Refresh token expired');
    }

    // Verify JWT
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Delete old refresh token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });

      // Generate new tokens
      return this.generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string; otp?: string }> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists
    const genericResponse = { message: 'If the email exists, a password reset OTP will be sent' } as const;

    // Rate limit OTP requests per email (fail closed for abuse, but fail open if Redis errors)
    try {
      const otpReqKey = `otp:req:${email}`;
      const current = await redis.incr(otpReqKey);
      if (current === 1) {
        await redis.expire(otpReqKey, 15 * 60); // 15 minutes
      }
      if (current > 3) {
        return genericResponse;
      }
    } catch (e) {
      logger.warn('OTP request rate limit failed (allowing request):', e);
    }

    if (!user) {
      return genericResponse;
    }

    // Generate OTP
    const otp = generateOTP(6);

    // Store OTP in Redis
    await redis.setex(`otp:${email}`, 900, JSON.stringify({ otp, userId: user.id }));
    // Track attempts separately
    await redis.setex(`otp:attempts:${email}`, 900, '0');

    // In production, send OTP via SMS/email
    // For development, return OTP
    logger.info(`Password reset OTP for ${email}: ${otp}`);

    return {
      ...genericResponse,
      ...(config.nodeEnv === 'development' ? { otp } : {}),
    };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const attemptsKey = `otp:attempts:${email}`;

    // Enforce attempt limits (fail open if Redis errors)
    try {
      const attempts = await redis.incr(attemptsKey);
      if (attempts === 1) {
        await redis.expire(attemptsKey, 900);
      }
      if (attempts > 5) {
        // Burn the OTP on too many attempts
        await redis.del(`otp:${email}`);
        await redis.del(attemptsKey);
        throw new BadRequestError('Too many OTP attempts. Please request a new OTP.');
      }
    } catch (err) {
      // If we threw BadRequestError above, rethrow. Otherwise allow request.
      if (err instanceof BadRequestError) throw err;
      logger.warn('OTP attempt rate limit failed (allowing attempt):', err);
    }

    const stored = await redis.get(`otp:${email}`);

    if (!stored) {
      throw new BadRequestError('Invalid or expired OTP');
    }

    const { otp: storedOtp, userId } = JSON.parse(stored);

    if (otp !== storedOtp) {
      throw new BadRequestError('Invalid OTP');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Delete OTP + attempts
    await redis.del(`otp:${email}`);
    await redis.del(attemptsKey);

    // Invalidate all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValid = await argon2.verify(user.password, currentPassword);
    if (!isValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as string,
    } as jwt.SignOptions);

    const tokenHash = sha256(refreshToken);

    // Store refresh token hash in database with expiry aligned to JWT expiry
    const expiresAt = new Date(
      Date.now() + this.parseExpiresInToMs(String(config.jwt.refreshExpiresIn))
    );

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: payload.userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string; fcmToken?: string }
  ): Promise<Partial<User>> {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const authService = new AuthService();
export default authService;
