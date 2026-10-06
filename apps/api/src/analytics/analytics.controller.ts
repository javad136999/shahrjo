import { Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/decorators';
import { ClientIp } from '../common/client-ip.decorator';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { AnalyticsService } from './analytics.service';

/**
 * Visit beacon (`POST /analytics/visit`): the web app pings once per page
 * load. Public by design, but throttled per IP through Redis so the counter
 * cannot be inflated by a loop; over-limit pings are dropped silently.
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Public()
  @Post('visit')
  @HttpCode(200)
  async visit(@ClientIp() ip: string): Promise<{ ok: true }> {
    const limit = await this.rateLimiter.hit(`visit:ip:${ip}`, 120, 3600);
    if (limit.allowed) await this.analytics.recordVisit();
    return { ok: true };
  }
}
