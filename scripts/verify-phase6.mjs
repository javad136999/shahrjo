// Structural & security check for Phase 6 (detail pages + profile + favorites).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/ads/ads.service.ts',
  'apps/api/src/ads/ads.controller.ts',
  'apps/api/src/ads/ads.service.spec.ts',
  'apps/api/src/content/content.service.ts',
  'apps/api/src/content/content.service.spec.ts',
  'apps/api/src/auth/jwt-auth.guard.ts',
  'apps/web/src/components/ad-detail.tsx',
  'apps/web/src/components/ad-detail.test.tsx',
  'apps/web/src/components/news-detail.tsx',
  'apps/web/src/components/business-detail.tsx',
  'apps/web/src/components/profile-view.tsx',
  'apps/web/src/components/profile-view.test.tsx',
  'apps/web/src/components/my-ads.tsx',
  'apps/web/src/app/ad/[id]/page.tsx',
  'apps/web/src/app/news/[slug]/page.tsx',
  'apps/web/src/app/business/[id]/page.tsx',
  'apps/web/src/app/profile/page.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: detail visibility rules, view counting, favorites ---
const adsController = read('apps/api/src/ads/ads.controller.ts');
for (const endpoint of ["@Get('ads/:id')", "@Post('ads/:id/favorite')", "@Get('ads/favorites')"]) {
  if (!adsController.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}
// 'ads/favorites' must be declared before 'ads/:id' or Express would parse
// "favorites" as an id and answer 400.
const favIdx = adsController.indexOf("@Get('ads/favorites')");
const detailIdx = adsController.indexOf("@Get('ads/:id')");
if (favIdx === -1 || detailIdx === -1 || favIdx > detailIdx) {
  console.error('SECURITY/ROUTING: GET ads/favorites must be declared before GET ads/:id');
  fail++;
}
if (!/@Public\(\)[\s\S]{0,80}@Get\('ads\/:id'\)/.test(adsController)) {
  console.error('SECURITY: GET /ads/:id must be @Public (with optional identity)');
  fail++;
}

const adsService = read('apps/api/src/ads/ads.service.ts');
for (const marker of ['APPROVED', 'expired', '!isOwner', 'viewCount: { increment: 1 }', "targetType: 'AD'", 'Number(price)']) {
  if (!adsService.includes(marker)) { console.error(`SECURITY: ads service detail/favorite missing ${marker}`); fail++; }
}
// hidden ads must 404 for non-owners, and the owner must never inflate views
if (!adsService.includes("throw new NotFoundException('آگهی یافت نشد')")) {
  console.error('SECURITY: hidden ad detail must 404 for strangers');
  fail++;
}

// Optional identity on public routes (owner preview + favorited flag).
const guard = read('apps/api/src/auth/jwt-auth.guard.ts');
if (!guard.includes('attachOptionalUser')) {
  console.error('GUARD: public routes must attach the user opportunistically');
  fail++;
}

const contentService = read('apps/api/src/content/content.service.ts');
for (const marker of ['newsDetail', 'businessDetail', "status: 'PUBLISHED'", "status: 'APPROVED'", 'viewCount: { increment: 1 }']) {
  if (!contentService.includes(marker)) { console.error(`CONTENT: missing ${marker}`); fail++; }
}
const contentController = read('apps/api/src/content/content.controller.ts');
for (const endpoint of ["@Get('news/:slug')", "@Get('businesses/:id')"]) {
  if (!contentController.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}

// --- Web: helpers, routes, links, shell entries ---
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getAdDetail', 'getNewsDetail', 'getBusinessDetail', 'toggleAdFavorite', 'getMyFavorites', 'updateProfile']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing ${helper}`); fail++; }
}

// Deep links live on the page that owns each feed now (home page shows only
// the welcome card, the golden showcase and the map).
const newsView = read('apps/web/src/components/city-news.tsx');
if (!newsView.includes('`/news/${item.slug}`')) { console.error('WEB: news view must link to /news/:slug'); fail++; }
const myAds = read('apps/web/src/components/my-ads.tsx');
if (!myAds.includes('`/ad/${ad.id}`')) { console.error('WEB: my-ads must link to /ad/:id'); fail++; }
const showcaseMarquee = read('apps/web/src/components/showcase-marquee.tsx');
if (!showcaseMarquee.includes('`/business/${item.id}`')) { console.error('WEB: showcase must link to /business/:id'); fail++; }

const bottomNav = read('apps/web/src/components/bottom-nav.tsx');
if (!bottomNav.includes('/profile')) { console.error('WEB: bottom nav must link to the profile page'); fail++; }
const headerActions = read('apps/web/src/components/header-actions.tsx');
if (!headerActions.includes('/profile')) { console.error('WEB: header must link to the profile page'); fail++; }

const adDetail = read('apps/web/src/components/ad-detail.tsx');
for (const marker of ['toggleAdFavorite', 'getTokens', 'notice--pending', 'images']) {
  if (!adDetail.includes(marker)) { console.error(`WEB: ad detail missing ${marker}`); fail++; }
}
const profileView = read('apps/web/src/components/profile-view.tsx');
for (const marker of ['getMyAds', 'getMyFavorites', 'MyAdsList', 'updateProfile']) {
  if (!profileView.includes(marker)) { console.error(`WEB: profile missing ${marker}`); fail++; }
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
walk('apps/api/src/ads');
walk('apps/api/src/content');

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase6')) { console.error('CI: verify:phase6 step missing'); fail++; }
if (!read('package.json').includes('verify:phase6')) { console.error('ROOT: verify:phase6 script missing'); fail++; }
const phase6Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*6\s*\|/.test(l));
if (!phase6Row || !phase6Row.includes('✅')) { console.error('DOCS: phase 6 must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['GET `/ads/:id`', 'POST `/ads/:id/favorite`', 'GET `/ads/favorites`', 'GET `/news/:slug`', 'GET `/businesses/:id`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 6 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 6 OK: ad/news/business details with view counting, owner preview, favorites, profile, docs/CI in sync');
