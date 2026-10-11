import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Prisma error codes that mean «the running code needs a migration that has
 * not been applied to this database yet» (missing table / missing column).
 * These used to surface as a bare 500 «خطای داخلی سرور», which told nobody
 * that the real fix is `prisma migrate deploy` (the wall broke exactly this way).
 */
const SCHEMA_DRIFT_CODES = new Set(['P2021', 'P2022']);

function schemaDriftCode(exception: unknown): string | null {
  if (!exception || typeof exception !== 'object') return null;
  const code = (exception as { code?: unknown }).code;
  return typeof code === 'string' && SCHEMA_DRIFT_CODES.has(code) ? code : null;
}

/**
 * Maps every error to the documented envelope:
 * `{ data: null, error: { code, message, details } }`.
 * Internal error details are never leaked to clients.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'خطای داخلی سرور';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        code = exception.name;
        message = body;
      } else if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        if (Array.isArray(o.message)) {
          code = 'VALIDATION_ERROR';
          message = 'اطلاعات ورودی نامعتبر است';
          details = o.message;
        } else {
          if (typeof o.code === 'string') code = o.code;
          if (typeof o.message === 'string') message = o.message;
          if (o.details !== undefined) details = o.details;
        }
      }
      if (status >= 500) this.logger.error(`${request.method} ${request.url} ${status} ${exception.message}`);
    } else {
      const drift = schemaDriftCode(exception);
      if (drift) {
        // Actionable, but still no table/column names leave the server.
        status = 503;
        code = 'SCHEMA_OUT_OF_DATE';
        message = 'سرویس در حال به‌روزرسانی است؛ کمی بعد دوباره تلاش کنید.';
        this.logger.error(
          `${request.method} ${request.url} ${status} ${drift} — database schema is behind the code; ` +
            'apply pending migrations (docker compose -f docker-compose.prod.yml exec -w /repo api npx prisma migrate deploy)',
        );
      } else if (exception instanceof Error) {
        this.logger.error(`${request.method} ${request.url} 500 ${exception.stack ?? exception.message}`);
      }
    }

    response.status(status).json({
      data: null,
      error: { code, message, details, path: request.url, timestamp: new Date().toISOString() },
    });
  }
}
