import 'reflect-metadata';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { NoStore } from './decorators';
import { TransformInterceptor } from './transform.interceptor';

class PublicController {
  @NoStore()
  tokenRoute() {}

  feed() {}
}

@NoStore()
class SessionIslandController {
  everything() {}
}

function makeContext(
  handler: () => void,
  cls: new () => unknown,
  req: { user?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  const ctx = {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
      }),
    }),
  };
  return { ctx: ctx as unknown as ExecutionContext, headers };
}

const nextOf = (value: unknown) => ({ handle: () => of(value) }) as CallHandler;

describe('TransformInterceptor (Cache-Control policy)', () => {
  const interceptor = new TransformInterceptor();

  it('wraps plain handler results into the { data } envelope', async () => {
    const { ctx } = makeContext(PublicController.prototype.feed, PublicController);
    const out = await firstValueFrom(interceptor.intercept(ctx, nextOf({ id: 7 })));
    expect(out).toEqual({ data: { id: 7 } });
  });

  it('keeps an already-enveloped response untouched', async () => {
    const { ctx } = makeContext(PublicController.prototype.feed, PublicController);
    const envelope = { data: [1], meta: { total: 1 }, error: null };
    const out = await firstValueFrom(interceptor.intercept(ctx, nextOf(envelope)));
    expect(out).toBe(envelope);
  });

  it('sets private, no-store on authenticated (personal) responses', async () => {
    const { ctx, headers } = makeContext(
      PublicController.prototype.feed,
      PublicController,
      { user: { id: 1 } },
    );
    await firstValueFrom(interceptor.intercept(ctx, nextOf({ name: 'x' })));
    expect(headers['Cache-Control']).toBe('private, no-store');
  });

  it('sets private, no-store on @NoStore routes even when anonymous', async () => {
    const { ctx, headers } = makeContext(
      PublicController.prototype.tokenRoute,
      PublicController,
    );
    await firstValueFrom(interceptor.intercept(ctx, nextOf({ token: 't' })));
    expect(headers['Cache-Control']).toBe('private, no-store');
  });

  it('honours class-level @NoStore for the whole controller', async () => {
    const { ctx, headers } = makeContext(
      SessionIslandController.prototype.everything,
      SessionIslandController,
    );
    await firstValueFrom(interceptor.intercept(ctx, nextOf({ sessions: [] })));
    expect(headers['Cache-Control']).toBe('private, no-store');
  });

  it('leaves public anonymous responses without a cache directive', async () => {
    const { ctx, headers } = makeContext(PublicController.prototype.feed, PublicController);
    await firstValueFrom(interceptor.intercept(ctx, nextOf({ cities: [] })));
    expect(headers['Cache-Control']).toBeUndefined();
  });
});
