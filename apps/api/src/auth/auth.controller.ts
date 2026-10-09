import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import type { User } from '@prisma/client';
import { ClientIp } from '../common/client-ip.decorator';
import { CurrentUser, NoStore, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { RefreshTokenDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';

// پاسخ‌های این کنترلر حساس‌اند (توکن/نوتیفیکیشن/نشست‌ها): هرگز کش نشوند.
@NoStore()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('send-otp')
  @HttpCode(200)
  sendOtp(@Body() dto: SendOtpDto, @ClientIp() ip: string): Promise<{ sent: true; cooldownSeconds: number }> {
    return this.auth.sendOtp({ phone: dto.phone, ip });
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @ClientIp() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): ReturnType<AuthService['verifyOtp']> {
    return this.auth.verifyOtp({ phone: dto.phone, code: dto.code, ip, userAgent });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body() dto: RefreshTokenDto,
    @ClientIp() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): ReturnType<AuthService['refresh']> {
    return this.auth.refresh({ refreshToken: dto.refreshToken, ip, userAgent });
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshTokenDto): ReturnType<AuthService['logout']> {
    return this.auth.logout({ refreshToken: dto.refreshToken });
  }

  /** Active sessions of the authenticated user (session security). */
  @Get('sessions')
  listSessions(@CurrentUser() user: User): ReturnType<AuthService['listSessions']> {
    return this.auth.listSessions(user);
  }

  /** Revokes every session of the user (all devices). */
  @Post('logout-all')
  @HttpCode(200)
  logoutAll(@CurrentUser() user: User): ReturnType<AuthService['logoutAll']> {
    return this.auth.logoutAll(user);
  }
}
