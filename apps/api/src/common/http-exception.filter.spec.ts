import { BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/** Minimal ArgumentsHost stub: the filter only touches req/res. */
function hostFor() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/api/v1/wall?city=jam' }),
    }),
  };
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  it('keeps the documented envelope for http exceptions', () => {
    const { host, status, json } = hostFor();
    new HttpExceptionFilter().catch(new BadRequestException('متن پیام الزامی است'), host as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].error.message).toBe('متن پیام الزامی است');
    expect(json.mock.calls[0][0].data).toBeNull();
  });

  it('reports an un-applied migration instead of a bare internal error', () => {
    // Exactly what Prisma throws when the DB is behind the code: e.g. the
    // wall's `wall_reads` table or `cities.wall_member_base` column missing.
    const { host, status, json } = hostFor();
    const prismaError = Object.assign(new Error('The table `public.wall_reads` does not exist'), {
      code: 'P2021',
      clientVersion: '6.19.3',
    });
    new HttpExceptionFilter().catch(prismaError, host as never);
    expect(status).toHaveBeenCalledWith(503);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('SCHEMA_OUT_OF_DATE');
    expect(body.error.message).toContain('به‌روزرسانی');
    // the internal table name never leaves the server
    expect(JSON.stringify(body)).not.toContain('wall_reads');
  });

  it('still hides unknown failures behind a generic 500', () => {
    const { host, status, json } = hostFor();
    new HttpExceptionFilter().catch(new Error('boom'), host as never);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور' });
  });
});
