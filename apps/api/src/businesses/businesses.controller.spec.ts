import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContentController } from '../content/content.controller';
import { PERMISSIONS_KEY, PUBLIC_KEY, RATE_LIMIT_KEY, type RateLimitOptions } from '../common/decorators';
import { BusinessesController } from './businesses.controller';

/**
 * Registration surface wiring: the permission must be enforced in the API
 * (not merely hidden in the UI), the create route must be rate-limited, the
 * status list must win the route order over `businesses/:id`, and the USER
 * role must actually be granted `businesses.create` in the seed — otherwise
 * every ordinary account would get a 403.
 */
describe('Business registration wiring', () => {
  it('enforces businesses.create on POST /businesses', () => {
    const permissions = Reflect.getMetadata(PERMISSIONS_KEY, BusinessesController.prototype.create);
    expect(permissions).toEqual(['businesses.create']);
  });

  it('rate-limits business creation (10/hour per user)', () => {
    const options = Reflect.getMetadata(RATE_LIMIT_KEY, BusinessesController.prototype.create) as RateLimitOptions;
    expect(options).toMatchObject({ key: 'business:create', limit: 10, windowSeconds: 3600, subject: 'user' });
  });

  it('declares GET /businesses/mine before GET /businesses/:id (no ParseIntPipe clash)', () => {
    const keys = Object.getOwnPropertyNames(ContentController.prototype);
    expect(keys.indexOf('myBusinesses')).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf('myBusinesses')).toBeLessThan(keys.indexOf('businessDetail'));
  });

  it('keeps GET /business-categories public (form step loads without a token)', () => {
    expect(Reflect.getMetadata(PUBLIC_KEY, ContentController.prototype.businessCategories)).toBe(true);
  });

  it('grants businesses.create to the USER role in the seed', () => {
    const seed = readFileSync(join(__dirname, '..', '..', '..', '..', 'prisma', 'seed', 'index.ts'), 'utf8');
    expect(seed).toMatch(/USER:\s*\[[^\]]*businesses\.create/);
  });
});
