import { RateLimiterService } from './rate-limiter.service';
import type { RedisService } from './redis.service';

class FakeRedis {
  store = new Map<string, { value: number; expiresAt?: number }>();

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) {
      this.store.set(key, { value: 1 });
      return 1;
    }
    entry.value += 1;
    return entry.value;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (entry) entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }
}

function makeLimiter(): { limiter: RateLimiterService; redis: FakeRedis } {
  const redis = new FakeRedis();
  const limiter = new RateLimiterService({ client: redis } as unknown as RedisService);
  return { limiter, redis };
}

describe('RateLimiterService', () => {
  it('allows requests up to the limit and blocks the next one', async () => {
    const { limiter } = makeLimiter();

    const first = await limiter.hit('k', 3, 60);
    const second = await limiter.hit('k', 3, 60);
    const third = await limiter.hit('k', 3, 60);
    const fourth = await limiter.hit('k', 3, 60);

    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, true]);
    expect([first.remaining, second.remaining, third.remaining]).toEqual([2, 1, 0]);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports a positive retryAfter when inside the window', async () => {
    const { limiter } = makeLimiter();
    const result = await limiter.hit('windowed', 5, 300);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(300);
  });

  it('resets after the window expires (key deleted)', async () => {
    const { limiter, redis } = makeLimiter();
    await limiter.hit('reset', 1, 60);
    const blocked = await limiter.hit('reset', 1, 60);
    expect(blocked.allowed).toBe(false);

    redis.store.delete('rl:reset'); // simulate TTL expiry
    const after = await limiter.hit('reset', 1, 60);
    expect(after.allowed).toBe(true);
  });

  it('keeps counters independent per key (ip vs phone)', async () => {
    const { limiter } = makeLimiter();
    await limiter.hit('ip:1.2.3.4', 1, 60);
    const other = await limiter.hit('phone:09123456789', 1, 60);
    expect(other.allowed).toBe(true);
  });
});
