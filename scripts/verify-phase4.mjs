// Structural & security check for Phase 4 (City Dashboard: news/ads/businesses).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/content/content.module.ts',
  'apps/api/src/content/content.controller.ts',
  'apps/api/src/content/content.service.ts',
  'apps/api/src/content/content.service.spec.ts',
  'apps/api/src/content/content.dto.ts',
  'apps/web/src/components/dashboard.tsx',
  'apps/web/src/components/dashboard.test.tsx',
  'apps/web/src/components/bottom-nav.tsx',
  'apps/web/src/components/bottom-nav.test.tsx',
  'apps/web/src/components/header-pills.tsx',
  'apps/web/src/components/header-pills.test.tsx',
  'apps/web/src/lib/format.ts',
  'apps/web/src/lib/format.test.ts',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- Backend security: public feeds must leak nothing but public, moderated content ---
const controller = read('apps/api/src/content/content.controller.ts');
for (const endpoint of ["@Get('news')", "@Get('ads')", "@Get('businesses')"]) {
  if (!controller.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}
if ((controller.match(/@Public\(\)/g) ?? []).length < 3) {
  console.error('SECURITY: all three feeds must be explicitly @Public()');
  fail++;
}

const service = read('apps/api/src/content/content.service.ts');
for (const marker of ['status: \'PUBLISHED\'', 'status: \'APPROVED\'', 'NotFoundException', 'isActive: true']) {
  if (!service.includes(marker)) { console.error(`SECURITY: content service must filter with ${marker}`); fail++; }
}
// Expired ads must be filtered even before the sweep runs.
if (!service.includes('expiresAt')) { console.error('SECURITY: ads must filter expired listings'); fail++; }
// BigInt price must be converted before JSON (serialization crash / type leak).
if (!service.includes('Number(price)')) { console.error('SERIALIZATION: BigInt price must be converted with Number()'); fail++; }
// City is resolved from slug — no raw city id input.
if (service.includes('cityId: query') || service.includes('where: { id: city')) {
  console.error('SECURITY: content must be resolved via city slug, not client ids');
  fail++;
}

const appModule = read('apps/api/src/app.module.ts');
if (!appModule.includes('ContentModule')) { console.error('MISSING ContentModule in AppModule'); fail++; }

// --- Frontend: dashboard consumes the same-origin API and renders all feeds ---
const page = read('apps/web/src/app/city/[slug]/page.tsx');
for (const helper of ['getCityNews', 'getCityAds', 'getCityBusinesses']) {
  if (!page.includes(helper)) { console.error(`WEB: dashboard must load ${helper}`); fail++; }
}
if (!page.includes('Promise.all')) { console.error('WEB: feeds should load in parallel'); fail++; }

const dashboard = read('apps/web/src/components/dashboard.tsx');
for (const section of ['اخبار شهر', 'آگهی‌ها', 'کسب‌وکارها']) {
  if (!dashboard.includes(section)) { console.error(`WEB: missing dashboard section "${section}"`); fail++; }
}

// --- JamCity-style shell: quick pills, bottom nav, icon tiles, section anchors ---
const layout = read('apps/web/src/app/layout.tsx');
for (const comp of ['HeaderPills', 'BottomNav']) {
  if (!layout.includes(comp)) { console.error(`WEB: layout must render ${comp}`); fail++; }
}
const bottomNav = read('apps/web/src/components/bottom-nav.tsx');
for (const marker of ['bottom-nav', 'getLocalCity', '#news', '#businesses', '/ads/new']) {
  if (!bottomNav.includes(marker)) { console.error(`WEB: bottom nav missing ${marker}`); fail++; }
}
const headerPills = read('apps/web/src/components/header-pills.tsx');
for (const marker of ['getLocalCity', '/ads/new']) {
  if (!headerPills.includes(marker)) { console.error(`WEB: header pills missing ${marker}`); fail++; }
}
for (const marker of ['icon-tile', 'stats-row', 'dash-section__head', 'id="news"', 'id="ads"', 'id="businesses"']) {
  if (!dashboard.includes(marker)) { console.error(`WEB: dashboard missing ${marker}`); fail++; }
}
const css = read('apps/web/src/app/globals.css');
for (const marker of ['.bottom-nav', '.pill', '.icon-tile', '.count-chip', '.stats-row', '.content-card--gold']) {
  if (!css.includes(marker)) { console.error(`CSS: theme missing ${marker}`); fail++; }
}

const apiClient = read('apps/web/src/lib/api.ts');
if (!apiClient.includes('/news?') || !apiClient.includes('/ads?') || !apiClient.includes('/businesses?')) {
  console.error('WEB: feed helpers missing from api client');
  fail++;
}

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
walk('apps/api/src/content');

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase4')) { console.error('CI: verify:phase4 step missing'); fail++; }
if (!read('package.json').includes('verify:phase4')) { console.error('ROOT: verify:phase4 script missing'); fail++; }
const phase4Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*4\s*\|/.test(l));
if (!phase4Row || !phase4Row.includes('✅')) { console.error('DOCS: phase 4 must be marked ✅ in docs/architecture.md'); fail++; }

if (fail) { console.error(`\nPhase 4 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 4 OK: city-scoped public feeds, moderation filters, BigInt-safe prices, dashboard sections');
