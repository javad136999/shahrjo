import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { TransformInterceptor } from './common/transform.interceptor';

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_HASH_SECRET'];

function assertRequiredEnv(config: ConfigService): void {
  const missing = REQUIRED_ENV.filter((key) => {
    const v = config.get<string>(key);
    return !v || v.includes('CHANGE_ME');
  });
  if (missing.length > 0) {
    new Logger('Env').error(
      `Missing/placeholder env values: ${missing.join(', ')}. Fix .env (see .env.example) and restart.`,
    );
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  assertRequiredEnv(app.get(ConfigService));

  app.setGlobalPrefix('api/v1');

  // Uploaded images (Phase 5): served under /api/v1/files/* so the reverse
  // proxy's existing /api rule forwards them — no new vhost configuration.
  app.useStaticAssets(resolve(process.env.STORAGE_LOCAL_DIR ?? './uploads'), {
    prefix: '/api/v1/files/',
    index: false,
    setHeaders: (res: ServerResponse) => {
      // Content-addressed random names: safe to cache hard.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
  app.enableCors({
    origin: [
      process.env.WEB_URL ?? 'http://localhost:3000',
      process.env.ADMIN_URL ?? 'http://localhost:3002',
    ],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`ShahrJo API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
