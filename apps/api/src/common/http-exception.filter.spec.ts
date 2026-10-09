import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, HttpException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(statusCode: number) {
  const headers: Record<string, string> = {};
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
  const request = { url: '/api/v1/ads/1' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    getResponse: () => response,
    getArguments: () => [],
  } as unknown as ArgumentsHost;
  return { filter: new HttpExceptionFilter(), response, headers, host, statusCode };
}

describe('HttpExceptionFilter (error caching policy)', () => {
  it('maps a plain BadRequestException to the standard envelope', () => {
    const { filter, response, host } = makeHost(400);
    filter.catch(new BadRequestException('bad input'), host);
    expect(response.status).toHaveBeenCalledWith(400);
    const body = response.json.mock.calls[0][0];
    expect(body.data).toBeNull();
    expect(body.error.message).toBe('bad input');
    expect(body.error.path).toBe('/api/v1/ads/1');
    expect(body.error.timestamp).toEqual(expect.any(String));
  });

  it('marks error responses as no-store so proxies never cache them', () => {
    const { filter, headers, host } = makeHost(400);
    filter.catch(new BadRequestException('x'), host);
    expect(headers['Cache-Control']).toBe('no-store');
  });

  it('keeps a custom code and the 429 status of rate-limit rejections', () => {
    const { filter, response, headers, host } = makeHost(429);
    const exception = new HttpException(
      { statusCode: 429, code: 'RATE_LIMITED', message: 'slow down', retryAfterSeconds: 30 },
      429,
    );
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(429);
    const body = response.json.mock.calls[0][0];
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toBe('slow down');
    expect(headers['Cache-Control']).toBe('no-store');
  });
});
