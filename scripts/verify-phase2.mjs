// Structural & security check for Phase 2 (Backend + Authentication).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/package.json',
  'apps/api/tsconfig.json',
  'apps/api/tsconfig.build.json',
  'apps/api/nest-cli.json',
  'apps/api/jest.config.js',
  'apps/api/src/main.ts',
  'apps/api/src/app.module.ts',
  'apps/api/src/auth/auth.module.ts',
  'apps/api/src/auth/auth.service.ts',
  'apps/api/src/auth/auth.controller.ts',
  'apps/api/src/auth/dto/auth.dto.ts',
  'apps/api/src/sms/sms.module.ts',
  'apps/api/src/sms/sms.provider.ts',
  'apps/api/src/sms/adapters/console.provider.ts',
  'apps/api/src/sms/adapters/kavenegar.provider.ts',
  'apps/api/src/sms/adapters/smsir.provider.ts',
  'apps/api/src/redis/rate-limiter.service.ts',
  'apps/api/src/auth/auth.service.spec.ts',
  'apps/api/src/auth/jwt-auth.guard.ts',
  'apps/api/src/auth/permissions.guard.ts',
  'apps/api/src/auth/jwt-auth.guard.spec.ts',
  'apps/api/src/common/decorators.ts',
  'apps/api/src/rbac/rbac.service.ts',
  'apps/api/src/rbac/rbac.module.ts',
  'apps/api/src/users/users.module.ts',
  'apps/api/src/users/users.service.ts',
  'apps/api/src/users/users.controller.ts',
  'docs/jamcity-reference.md',
  'scripts/smoke.mjs',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const controller = existsSync('apps/api/src/auth/auth.controller.ts')
  ? readFileSync('apps/api/src/auth/auth.controller.ts', 'utf8')
  : '';
for (const endpoint of ['send-otp', 'verify-otp', 'refresh', 'logout', 'sessions', 'logout-all']) {
  if (!controller.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}

// Schema must be ready for Gold/Silver, Subscription, ZarinPal and Storage (from day one).
const schema = existsSync('prisma/schema.prisma') ? readFileSync('prisma/schema.prisma', 'utf8') : '';
for (const marker of ['ZARINPAL', 'SubscriptionTier', 'showcasePriority', 'storageKey', 'subscription_plans']) {
  if (!schema.includes(marker)) { console.error(`SCHEMA not ready: missing "${marker}"`); fail++; }
}

// Guard registration: authentication must be global.
const appModule = existsSync('apps/api/src/app.module.ts')
  ? readFileSync('apps/api/src/app.module.ts', 'utf8')
  : '';
const authModule = existsSync('apps/api/src/auth/auth.module.ts')
  ? readFileSync('apps/api/src/auth/auth.module.ts', 'utf8')
  : '';
if (!authModule.includes('APP_GUARD') || !authModule.includes('JwtAuthGuard')) {
  console.error('SECURITY: JwtAuthGuard is not registered as a global guard');
  fail++;
}
if (!appModule.includes('UsersModule')) { console.error('MISSING UsersModule in AppModule'); fail++; }

const service = existsSync('apps/api/src/auth/auth.service.ts')
  ? readFileSync('apps/api/src/auth/auth.service.ts', 'utf8')
  : '';

// Security: OTP and refresh tokens must be stored peppered-hashed, never raw.
if (!service.includes('hmacOtp(')) { console.error('SECURITY: OTP hashing (hmacOtp) missing'); fail++; }
if (!service.includes('hmacToken(')) { console.error('SECURITY: refresh token hashing (hmacToken) missing'); fail++; }
if (!service.includes('consumedAt')) { console.error('SECURITY: one-time-use OTP guard missing'); fail++; }
if (!service.includes('revokedAt')) { console.error('SECURITY: session revocation missing'); fail++; }
if (!service.includes('rateLimiter.hit')) { console.error('SECURITY: rate limiting missing'); fail++; }

// No hardcoded city names anywhere in the backend (multi-city rule).
const hardcoded = ['جم', 'عسلویه', 'شیراز', 'بوشهر', 'کنگان'];
if (existsSync('apps/api/src')) {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|mjs|js)$/.test(full)) {
        const text = readFileSync(full, 'utf8');
        for (const city of hardcoded) {
          // Whole-word match only: «جم» must not fire inside another word (e.g. «حجم»).
          const cityRe = new RegExp(`(?<![\\u0600-\\u06FF])${city}(?![\\u0600-\\u06FF])`);
          if (cityRe.test(text)) { console.error(`HARDCODED city "${city}" in ${full}`); fail++; }
        }
      }
    }
  };
  walk('apps/api/src');
}

if (fail) { console.error(`\nPhase 2 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 2 OK: structure, endpoints, hashed OTP/tokens, rate limiting, no hardcoded cities');
