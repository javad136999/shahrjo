// Structural & security check for Phase 3 (City Selection + Next.js frontend).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/web/package.json',
  'apps/web/tsconfig.json',
  'apps/web/next.config.ts',
  'apps/web/jest.config.js',
  'apps/web/jest.setup.ts',
  'apps/web/public/robots.txt',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/globals.css',
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/login/page.tsx',
  'apps/web/src/app/city/[slug]/page.tsx',
  'apps/web/src/components/city-grid.tsx',
  'apps/web/src/components/login-form.tsx',
  'apps/web/src/components/header-actions.tsx',
  'apps/web/src/lib/api.ts',
  'apps/web/src/lib/types.ts',
  'apps/web/src/lib/api.test.ts',
  'apps/web/src/components/city-grid.test.tsx',
  'apps/web/src/components/login-form.test.tsx',
  'apps/api/src/cities/cities.module.ts',
  'apps/api/src/cities/cities.controller.ts',
  'apps/api/src/cities/cities.service.ts',
  'apps/api/src/cities/cities.service.spec.ts',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- Next.js app must be production-ready ---
const nextConfig = read('apps/web/next.config.ts');
if (!nextConfig.includes("output: 'standalone'")) { console.error('NEXT: standalone output missing (Docker image size)'); fail++; }
if (!nextConfig.includes("source: '/api/:path*'")) { console.error('NEXT: /api rewrite missing (same-origin API proxy)'); fail++; }

const webPkg = read('apps/web/package.json');
for (const dep of ['next', 'react', 'react-dom']) {
  if (!webPkg.includes(`"${dep}"`)) { console.error(`WEB: missing dependency ${dep}`); fail++; }
}
for (const script of ['build', 'start', 'typecheck', 'test']) {
  if (!webPkg.includes(`"${script}"`)) { console.error(`WEB: missing script ${script}`); fail++; }
}

// --- The app must talk to the API via same-origin /api/v1 (no absolute hosts in browser code) ---
const apiClient = read('apps/web/src/lib/api.ts');
if (!apiClient.includes("'/api/v1'")) { console.error('WEB: API client must use the /api/v1 prefix'); fail++; }
if (!apiClient.includes('tryRefresh')) { console.error('WEB: token refresh on 401 missing'); fail++; }
if (!apiClient.includes('localStorage')) { console.error('WEB: token storage missing'); fail++; }

// --- RTL/Persian shell ---
const layout = read('apps/web/src/app/layout.tsx');
if (!layout.includes('dir="rtl"') || !layout.includes('lang="fa"')) { console.error('WEB: layout must be RTL Persian (lang=fa dir=rtl)'); fail++; }

// --- Backend: public city list + validated profile city selection ---
const citiesController = read('apps/api/src/cities/cities.controller.ts');
if (!citiesController.includes('@Public()')) { console.error('SECURITY: GET /cities must be explicitly @Public()'); fail++; }
const usersService = read('apps/api/src/users/users.service.ts');
if (!usersService.includes('isActive: true')) { console.error('SECURITY: cityId must be validated against active cities'); fail++; }
if (!usersService.includes('NotFoundException')) { console.error('SECURITY: unknown city must 404'); fail++; }
const profileDto = read('apps/api/src/auth/dto/auth.dto.ts');
if (!profileDto.includes('cityId?: number') || !profileDto.includes('@IsInt()')) { console.error('DTO: cityId must be an integer-validated field'); fail++; }
const appModule = read('apps/api/src/app.module.ts');
if (!appModule.includes('CitiesModule')) { console.error('MISSING CitiesModule in AppModule'); fail++; }

// --- Same multi-city rule as Phase 2: no hard-coded city names anywhere ---
const hardcoded = ['جم', 'عسلویه', 'شیراز', 'بوشهر', 'کنگان'];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs|js)$/.test(full)) {
      const text = readFileSync(full, 'utf8');
      for (const city of hardcoded) {
        if (text.includes(city)) { console.error(`HARDCODED city "${city}" in ${full}`); fail++; }
      }
    }
  }
};
walk('apps/web/src');
walk('apps/api/src/cities');

// --- CI + docs stay in sync with the phase ---
const ci = read('.github/workflows/ci.yml');
if (!ci.includes('verify:phase3')) { console.error('CI: verify:phase3 step missing'); fail++; }

const rootPkg = read('package.json');
if (!rootPkg.includes('verify:phase3')) { console.error('ROOT: verify:phase3 script missing'); fail++; }

const architecture = read('docs/architecture.md');
const phase3Row = architecture.split('\n').find((l) => /^\|\s*3\s*\|/.test(l));
if (!phase3Row || !phase3Row.includes('✅')) { console.error('DOCS: phase 3 must be marked ✅ in docs/architecture.md'); fail++; }

if (fail) { console.error(`\nPhase 3 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 3 OK: Next.js shell, city selection, /api/v1 client, validated cityId, no hardcoded cities');
