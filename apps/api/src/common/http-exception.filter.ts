import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

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
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} 500 ${exception.stack ?? exception.message}`);
    }

    // Error responses may leak state (rate-limit details, auth failures) —
    // never let a browser or proxy cache them.
    if (!response.getHeader('Cache-Control')) {
      response.setHeader('Cache-Control', 'no-store');
    }

    response.status(status).json({
      data: null,
      error: { code, message, details, path: request.url, timestamp: new Date().toISOString() },
    });
  }
}
