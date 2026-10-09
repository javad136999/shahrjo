import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdsModule } from './ads/ads.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { CitiesModule } from './cities/cities.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './health/health.controller';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { RedisModule } from './redis/redis.module';
import { SmsModule } from './sms/sms.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { WallModule } from './wall/wall.module';

@Module({
  imports: [
    // Root .env is canonical; local apps/api/.env (if any) is a fallback.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    RedisModule,
    RbacModule,
    SmsModule,
    AuthModule,
    UsersModule,
    CitiesModule,
    ContentModule,
    BusinessesModule,
    AdsModule,
    UploadsModule,
    PaymentsModule,
    AdminModule,
    WallModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
