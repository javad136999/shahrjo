// Structural & security check for Phase 8 (admin panel + moderation queues).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/admin/admin.module.ts',
  'apps/api/src/admin/admin.controller.ts',
  'apps/api/src/admin/admin.service.ts',
  'apps/api/src/admin/admin.service.spec.ts',
  'apps/web/src/components/admin-panel.tsx',
  'apps/web/src/components/admin-panel.test.tsx',
  'apps/web/src/app/admin/page.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: every admin route must be permission-guarded ---
const controller = read('apps/api/src/admin/admin.controller.ts');
const endpoints = [
  "@Get('overview')",
  "@Get('ads')",
  "@Post('ads/:id/approve')",
  "@Post('ads/:id/reject')",
  "@Get('businesses')",
  "@Post('businesses/:id/approve')",
  "@Post('businesses/:id/reject')",
  "@Get('subscriptions')",
  "@Post('subscriptions/:id/approve')",
  "@Post('subscriptions/:id/reject')",
  "@Post('cities/:id/boundary')",
  "@Get('storage/overview')",
  "@Post('storage/sweep')",
];
for (const endpoint of endpoints) {
  if (!controller.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}
// Every @Get/@Post handler must carry @RequirePermissions between it and the next route.
const routeRe = /@(Get|Post)\('[^']*'\)/g;
const routeMatches = [...controller.matchAll(routeRe)];
if (routeMatches.length !== endpoints.length) {
  console.error(`ADMIN: expected ${endpoints.length} routes, found ${routeMatches.length}`);
  fail++;
}
for (let i = 0; i < routeMatches.length; i++) {
  const start = routeMatches[i].index + routeMatches[i][0].length;
  const end = i + 1 < routeMatches.length ? routeMatches[i + 1].index : controller.length;
  const chunk = controller.slice(start, end);
  if (!chunk.includes('@RequirePermissions(')) {
    console.error('SECURITY: admin route without @RequirePermissions:', routeMatches[i][0]);
    fail++;
  }
}

// --- Service: scope enforcement + moderation invariants ---
const service = read('apps/api/src/admin/admin.service.ts');
for (const marker of [
  'getScope', // scope comes from RBAC, never from the request
  'cityId', // city admins narrowed by city
  'provinceId', // province admins narrowed by province
  "status: 'APPROVED'",
  "status: 'REJECTED'",
  'PENDING_REVIEW', // paid subscriptions wait for this exact state
  'reviewedById',
  'auditLog.create', // every decision is audited
  'subscriptionExpiresAt', // approval never shortens an active period
  'showcasePriority', // gold/silver feed the showcase order
]) {
  if (!service.includes(marker)) { console.error(`ADMIN: missing ${marker}`); fail++; }
}
// A rejection must require a reason.
if (!service.includes('علت رد')) { console.error('ADMIN: reject must require a reason'); fail++; }
// Approvals must not trust client ids outside scope (findFirst + scope filter).
if (!service.includes('findFirst')) { console.error('ADMIN: lookups must be scoped findFirst, not findUnique'); fail++; }

// Seed: the admin operator phone is data (kept in seed, not in src code).
const seed = read('prisma/seed/index.ts');
if (!seed.includes('09174057031')) { console.error('SEED: admin operator phone missing'); fail++; }
if (!seed.includes('SUPER_ADMIN')) { console.error('SEED: admin role binding missing'); fail++; }
const adminPhoneInSrc = /09174057031/.test(read('apps/api/src/admin/admin.service.ts')) || /09174057031/.test(read('apps/web/src/components/admin-panel.tsx'));
if (adminPhoneInSrc) { console.error('SECURITY: admin phone must not be hardcoded in src (seed only)'); fail++; }

// App module registers the admin module.
if (!read('apps/api/src/app.module.ts').includes('AdminModule')) {
  console.error('APP: AdminModule not registered'); fail++;
}

// --- Web: panel gates + entries ---
const panel = read('apps/web/src/components/admin-panel.tsx');
for (const marker of ['getTokens', '/login?next=/admin', 'getProfile', 'roles', 'دسترسی ندارید', 'approveAdminAd', 'rejectAdminAd', 'approveAdminSubscription']) {
  if (!panel.includes(marker)) { console.error(`WEB: admin panel missing ${marker}`); fail++; }
}
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getAdminOverview', 'getAdminAds', 'approveAdminAd', 'rejectAdminAd', 'getAdminBusinesses', 'approveAdminBusiness', 'getAdminSubscriptions', 'approveAdminSubscription']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing ${helper}`); fail++; }
}
// Entries: header (operators only) and profile.
const headerActions = read('apps/web/src/components/header-actions.tsx');
if (!headerActions.includes('/admin') || !headerActions.includes('roles.some')) {
  console.error('WEB: header admin entry must be role-gated'); fail++;
}
const profile = read('apps/web/src/components/profile-view.tsx');
if (!profile.includes('/admin')) { console.error('WEB: profile must link to the admin panel'); fail++; }

// --- Same multi-city rule: no hard-coded city names ---
const hardcoded = ['جم', 'عسلویه', 'شیراز', 'بوشهر', 'کنگان'];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs|js)$/.test(full)) {
      const text = readFileSync(full, 'utf8');
      for (const city of hardcoded) {
        // Whole-word match only: «جم» must not fire inside another word (e.g. «حجم»).
        const cityRe = new RegExp(`(?<![\\u0600-\\u06FF])${city}(?![\\u0600-\\u06FF])`);
        if (cityRe.test(text)) { console.error(`HARDCODED city "${city}" in ${full}`); fail++; }
      }
    }
  }
};
walk('apps/web/src');
walk('apps/api/src/admin');

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase8')) { console.error('CI: verify:phase8 step missing'); fail++; }
if (!read('package.json').includes('verify:phase8')) { console.error('ROOT: verify:phase8 script missing'); fail++; }
const phase8Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*8\s*\|/.test(l));
if (!phase8Row || !phase8Row.includes('✅')) { console.error('DOCS: phase 8 must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['GET `/admin/overview`', 'POST `/admin/ads/:id/approve`', 'POST `/admin/businesses/:id/approve`', 'POST `/admin/subscriptions/:id/approve`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 8 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 8 OK: permission-guarded admin queues with RBAC scoping, audited decisions, seed operator, docs/CI in sync');
