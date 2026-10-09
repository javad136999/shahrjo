import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NO_STORE_KEY } from './decorators';

/**
 * Wraps controller results into the documented `{ data, meta, error }` envelope
 * and applies the caching policy for personal/sensitive JSON responses:
 * `Cache-Control: private, no-store` whenever the request is authenticated
 * (the payload may contain user-specific fields — profile, payments,
 * favorited flags, owner previews) or the route is marked `@NoStore()`
 * (token responses, ad detail). Static uploads keep their own immutable
 * header (set in main.ts) — they never pass through interceptors.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    this.applyCachePolicy(context);
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === 'object' && 'data' in result) return result;
        return { data: result ?? null };
      }),
    );
  }

  private applyCachePolicy(context: ExecutionContext): void {
    if (context.getType() !== 'http') return;
    const http = context.switchToHttp();
    const req = http.getRequest<{ user?: unknown }>();
    const marked = this.isNoStore(context);
    if (marked || req.user) {
      http.getResponse<{ setHeader(name: string, value: string): void }>()
        .setHeader('Cache-Control', 'private, no-store');
    }
  }

  private isNoStore(context: ExecutionContext): boolean {
    return (
      Reflect.getMetadata(NO_STORE_KEY, context.getHandler()) === true ||
      Reflect.getMetadata(NO_STORE_KEY, context.getClass()) === true
    );
  }
}
