import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hmacOtp, hmacToken, normalizePhone, parseTtlMs, safeEqualHex, generateOtpCode } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { SMS_PROVIDER, type SmsProvider } from '../sms/sms.types';

export interface AuthUser {
  id: number;
  phone: string;
  fullName: string | null;
  avatarUrl: string | null;
  cityId: number | null; // null => first-run city selection (Phase 3)
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/**
 * Phone + SMS OTP authentication (no passwords).
 * - OTP: hashed with a pepper, expiry, attempt limit, one-time use.
 * - Rate limits: IP + phone via Redis (send) and phone+IP (verify).
 * - Sessions: opaque refresh token, stored peppered-hashed, rotating,
 *   with reuse detection (revoked token => revoke all user sessions).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimiter: RateLimiterService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  // ================= send OTP =================

  async sendOtp(input: { phone: string; ip: string }): Promise<{ sent: true; cooldownSeconds: number }> {
    const phone = this.requirePhone(input.phone);

    const ipLimit = await this.rateLimiter.hit(`otp:send:ip:${input.ip}`, this.int('OTP_IP_LIMIT_PER_HOUR', 20), 3600);
    if (!ipLimit.allowed) throw this.rateLimited(ipLimit.retryAfterSeconds);

    const phoneLimit = await this.rateLimiter.hit(
      `otp:send:phone:${phone}`,
      this.int('OTP_REQUEST_LIMIT_PER_HOUR', 5),
      3600,
    );
    if (!phoneLimit.allowed) throw this.rateLimited(phoneLimit.retryAfterSeconds);

    const cooldown = this.int('OTP_RESEND_COOLDOWN_SECONDS', 60);
    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, purpose: 'LOGIN', createdAt: { gte: new Date(Date.now() - cooldown * 1000) } },
      select: { id: true },
    });
    if (recent) throw this.rateLimited(cooldown);

    const code = generateOtpCode(this.int('OTP_LENGTH', 5));
    const codeHash = hmacOtp(this.require('OTP_HASH_SECRET'), phone, code);
    const ttlSeconds = this.int('OTP_TTL_SECONDS', 120);

    // Only the newest code stays active.
    await this.prisma.otpCode.updateMany({
      where: { phone, purpose: 'LOGIN', consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash,
        purpose: 'LOGIN',
        maxAttempts: this.int('OTP_MAX_ATTEMPTS', 5),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        lastIp: input.ip ? input.ip.slice(0, 45) : null,
      },
    });

    const result = await this.sms.sendOtp(phone, code);
    if (!result.success) {
      await this.prisma.otpCode.updateMany({
        where: { phone, purpose: 'LOGIN', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      this.logger.error(`SMS failed via ${this.sms.name}: ${result.error}`);
      throw new HttpException(
        { code: 'SMS_SEND_FAILED', message: 'ارسال پیامک ممکن نشد؛ کمی بعد دوباره تلاش کنید' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return { sent: true, cooldownSeconds: cooldown };
  }

  // ================= verify OTP =================

  async verifyOtp(input: { phone: string; code: string; ip: string; userAgent?: string }): Promise<AuthTokens> {
    const phone = this.requirePhone(input.phone);

    const phoneLimit = await this.rateLimiter.hit(`otp:verify:phone:${phone}`, 10, 300);
    if (!phoneLimit.allowed) throw this.rateLimited(phoneLimit.retryAfterSeconds);
    const ipLimit = await this.rateLimiter.hit(`otp:verify:ip:${input.ip}`, 30, 300);
    if (!ipLimit.allowed) throw this.rateLimited(ipLimit.retryAfterSeconds);

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose: 'LOGIN', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt.getTime() <= Date.now()) throw this.invalidOtp();

    const candidate = hmacOtp(this.require('OTP_HASH_SECRET'), phone, input.code);
    if (!safeEqualHex(candidate, otp.codeHash)) {
      const updated = await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= updated.maxAttempts) {
        await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      }
      throw this.invalidOtp();
    }

    // Atomic one-time-use guard (two concurrent verifies => only one wins).
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw this.invalidOtp();

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, lastLoginAt: new Date() } });
    } else if (user.status === 'BANNED') {
      throw new HttpException(
        { code: 'ACCOUNT_BANNED', message: 'حساب کاربری شما مسدود شده است' },
        HttpStatus.FORBIDDEN,
      );
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), status: 'ACTIVE' },
      });
    }

    return this.issueTokens(user, input.ip, input.userAgent);
  }

  // ================= refresh (rotating) =================

  async refresh(input: { refreshToken: string; ip: string; userAgent?: string }): Promise<AuthTokens> {
    const secret = this.require('JWT_REFRESH_SECRET');
    const tokenHash = hmacToken(secret, input.refreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: tokenHash } });

    if (!session || session.expiresAt.getTime() <= Date.now()) throw this.unauthorized();

    if (session.revokedAt) {
      // Reuse of a rotated token => assume theft, revoke the whole family.
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw this.unauthorized();
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status !== 'ACTIVE') throw this.unauthorized();

    await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(user, input.ip, input.userAgent);
  }

  // ================= logout =================

  async logout(input: { refreshToken: string }): Promise<{ loggedOut: true }> {
    const secret = this.require('JWT_REFRESH_SECRET');
    const tokenHash = hmacToken(secret, input.refreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: tokenHash } });
    if (session && !session.revokedAt) {
      await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    }
    return { loggedOut: true };
  }

  // ================= sessions (session security) =================

  async listSessions(user: User): Promise<{
    sessions: { id: number; createdAt: Date; lastUsedAt: Date | null; ipAddress: string | null; userAgent: string | null }[];
  }> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, lastUsedAt: true, ipAddress: true, userAgent: true },
    });
    return { sessions };
  }

  async logoutAll(user: User): Promise<{ revoked: number }> {
    const result = await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  // ================= helpers =================

  private async issueTokens(user: User, ip: string, userAgent?: string): Promise<AuthTokens> {
    const refreshSecret = this.require('JWT_REFRESH_SECRET');
    const refreshToken = randomBytes(48).toString('base64url');

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hmacToken(refreshSecret, refreshToken),
        expiresAt: new Date(Date.now() + parseTtlMs(this.config.get<string>('JWT_REFRESH_TTL'), 30 * 86_400_000)),
        ipAddress: ip ? ip.slice(0, 45) : null,
        userAgent: userAgent ? userAgent.slice(0, 255) : null,
      },
    });

    // sid = session id: lets us identify the current session later.
    const accessToken = await this.jwt.signAsync({ sub: user.id, phone: user.phone, sid: session.id });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        cityId: user.cityId,
      },
    };
  }

  private requirePhone(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) {
      throw new HttpException(
        { code: 'INVALID_PHONE', message: 'شماره موبایل معتبر نیست' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return phone;
  }

  private invalidOtp(): HttpException {
    return new HttpException(
      { code: 'INVALID_OTP', message: 'کد ورود نامعتبر یا منقضی شده است' },
      HttpStatus.BAD_REQUEST,
    );
  }

  private rateLimited(retryAfterSeconds: number): HttpException {
    return new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید',
        details: { retryAfterSeconds },
      },
      429,
    );
  }

  private unauthorized(): HttpException {
    return new HttpException(
      { code: 'INVALID_REFRESH_TOKEN', message: 'نشست شما منقضی شده است؛ دوباره وارد شوید' },
      HttpStatus.UNAUTHORIZED,
    );
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new Error(`Missing required env: ${key}`);
    return value;
  }

  private int(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
