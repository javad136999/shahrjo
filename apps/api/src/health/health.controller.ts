import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Liveness/readiness probe for Docker healthchecks, Nginx and uptime monitors. */
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('health')
  async health() {
    const checks = { database: false, redis: false };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      /* keep false */
    }
    try {
      checks.redis = (await this.redis.client.ping()) === 'PONG';
    } catch {
      /* keep false */
    }

    if (!checks.database || !checks.redis) {
      throw new ServiceUnavailableException({
        code: 'UNHEALTHY',
        message: 'سرویس‌های وابسته در دسترس نیستند',
        details: checks,
      });
    }
    return { status: 'ok', checks, uptimeSeconds: Math.round(process.uptime()) };
  }
}
