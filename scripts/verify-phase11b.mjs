// Structural & security check for Phase 11b:
// owner business workspace (profile edit) + menu & products (عکس/مشخصات/قیمت),
// the menu shown on the public business page (map → business entry), the
// always-visible bottom bar on the city home and the WhatsApp-style composer.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/businesses/businesses.menu.spec.ts',
  'apps/web/src/components/my-businesses.tsx',
  'apps/web/src/components/my-businesses.test.tsx',
  'apps/web/src/components/business-manage.tsx',
  'apps/web/src/components/business-manage.test.tsx',
  'apps/web/src/components/business-detail.test.tsx',
  'apps/web/src/app/businesses/page.tsx',
  'apps/web/src/app/business/[id]/manage/page.tsx',
  'prisma/migrations/20261012000000_business_menu_products/migration.sql',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- Prisma: the menu table + cascade ---
const schema = read('prisma/schema.prisma');
for (const marker of ['model BusinessProduct', 'business_products', 'section', 'price       BigInt?', 'isAvailable']) {
  if (!schema.includes(marker)) { console.error(`PRISMA: missing ${marker}`); fail++; }
}
if (!/model Business \{[\s\S]*?products      BusinessProduct\[\]/.test(schema)) {
  console.error('PRISMA: Business must own its products relation');
  fail++;
}
const migration = read('prisma/migrations/20261012000000_business_menu_products/migration.sql');
for (const marker of [
  'CREATE TABLE "business_products"',
  '"price" BIGINT',
  '"section" VARCHAR(80)',
  '"is_available" BOOLEAN NOT NULL DEFAULT true',
  'REFERENCES "businesses"("id") ON DELETE CASCADE',
]) {
  if (!migration.includes(marker)) { console.error(`MIGRATION: missing ${marker}`); fail++; }
}

// --- API: owner-scoped routes (no public route collision) ---
const controller = read('apps/api/src/businesses/businesses.controller.ts');
const routes = [
  "@Get('my-businesses')",
  "@Get('my-businesses/:id')",
  "@Patch('my-businesses/:id')",
  "@Post('my-businesses/:id/products')",
  "@Patch('my-businesses/:id/products/:productId')",
  "@Delete('my-businesses/:id/products/:productId')",
];
for (const route of routes) {
  if (!controller.includes(route)) { console.error('API: missing route', route); fail++; }
}
// No /businesses/mine style route that the public :id route could swallow.
if (/@(Get|Patch)\(\s*'businesses\/mine'/.test(controller)) {
  console.error('API/ROUTING: owner routes must not collide with GET /businesses/:id');
  fail++;
}
// Every owner route is behind the JWT guard (no @Public on /my-businesses).
if (/@Public\(\)[\s\S]{0,160}my-businesses/.test(controller)) {
  console.error('SECURITY: owner routes must never be @Public');
  fail++;
}

const service = read('apps/api/src/businesses/businesses.service.ts');
for (const marker of [
  'ownerId: user.id', // scoping, never a client-supplied owner id
  'assertOwned',
  'assertOwnedProduct',
  "throw new NotFoundException('کسب‌وکار یافت نشد')",
  "throw new NotFoundException('محصول یافت نشد')",
  'businessProduct.update',
  'businessProduct.delete',
  'BigInt(',
]) {
  if (!service.includes(marker)) { console.error(`SERVICE: missing ${marker}`); fail++; }
}
// The product must be checked against its business, not just its own id.
if (!/businessProduct\.findFirst\(\{[\s\S]{0,120}where: \{ id: productId, businessId \}/.test(service)) {
  console.error('SECURITY: product lookups must be scoped by businessId');
  fail++;
}

// --- Public detail carries the menu (map → business entry) ---
const contentService = read('apps/api/src/content/content.service.ts');
for (const marker of ['BusinessProductItem', 'products: {', 'price: product.price === null ? null : Number(product.price)']) {
  if (!contentService.includes(marker)) { console.error(`CONTENT: missing ${marker}`); fail++; }
}

// --- Web: owner UI, public menu, bottom nav, composer ---
const manage = read('apps/web/src/components/business-manage.tsx');
for (const marker of [
  'getMyBusiness',
  'updateMyBusiness',
  'createBusinessProduct',
  'updateBusinessProduct',
  'deleteBusinessProduct',
  'uploadImage', // product photo
  'data-testid="product-price"',
  'data-testid="product-section"',
  'biz-menu__group', // menu grouped by section
]) {
  if (!manage.includes(marker)) { console.error(`WEB manage: missing ${marker}`); fail++; }
}

const myBusinesses = read('apps/web/src/components/my-businesses.tsx');
for (const marker of ['getMyBusinesses', 'login?next=/businesses', '/manage']) {
  if (!myBusinesses.includes(marker)) { console.error(`WEB my-businesses: missing ${marker}`); fail++; }
}

const detail = read('apps/web/src/components/business-detail.tsx');
for (const marker of ['data-testid="business-menu"', 'menuSections', 'formatPrice', 'thumbUrlFor', 'ناموجود']) {
  if (!detail.includes(marker)) { console.error(`WEB detail: missing ${marker}`); fail++; }
}

// Bottom bar: always visible on the city home, businesses instead of news.
const bottomNav = read('apps/web/src/components/bottom-nav.tsx');
for (const marker of ["'/businesses'", 'bottom-nav--always', 'nav-pinned', 'کسب‌وکارها']) {
  if (!bottomNav.includes(marker)) { console.error(`WEB nav: missing ${marker}`); fail++; }
}
if (bottomNav.includes("label: 'اخبار'")) {
  console.error('WEB nav: the news icon must stay out of the bottom bar');
  fail++;
}
const css = read('apps/web/src/app/globals.css');
for (const marker of [
  '.bottom-nav.bottom-nav--always',
  'body.nav-pinned',
  '.wall-bar',
  '.biz-menu-public__item',
  '.mybiz__card',
  '.biz-tabs__item',
]) {
  if (!css.includes(marker)) { console.error(`CSS: missing ${marker}`); fail++; }
}

// Composer: WhatsApp-style bar with photo · input · mic · send, ad icon beside.
const wallView = read('apps/web/src/components/wall-view.tsx');
for (const marker of ['className="wall-bar"', 'wall-bar__input', 'wall-tool--ad', 'wall-tool--inline']) {
  if (!wallView.includes(marker)) { console.error(`WEB wall: missing ${marker}`); fail++; }
}
if (wallView.includes('wall-home-bottom') || wallView.includes('wall-quick__item--home')) {
  console.error('WEB wall: the city-home icon must be gone from the composer dock');
  fail++;
}

// Phone number / owner data must never leak into a menu row payload.
const productSelect = service.slice(service.indexOf('async addProduct'), service.indexOf('async updateProduct'));
if (productSelect.includes('ownerId: true') || productSelect.includes("phone: user.")) {
  console.error('SECURITY: product payloads must not carry owner identity');
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
        const cityRe = new RegExp(`(?<![\\u0600-\\u06FF])${city}(?![\\u0600-\\u06FF])`);
        if (cityRe.test(text)) { console.error(`HARDCODED city "${city}" in ${full}`); fail++; }
      }
    }
  }
};
walk('apps/web/src');
walk('apps/api/src/businesses');

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase11b')) { console.error('CI: verify:phase11b step missing'); fail++; }
if (!read('package.json').includes('verify:phase11b')) { console.error('ROOT: verify:phase11b script missing'); fail++; }
const row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*11b\s*\|/.test(l));
if (!row || !row.includes('✅')) { console.error('DOCS: phase 11b must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of [
  'GET `/my-businesses`',
  'GET `/my-businesses/:id`',
  'PATCH `/my-businesses/:id`',
  'POST `/my-businesses/:id/products`',
  'PATCH `/my-businesses/:id/products/:productId`',
  'DELETE `/my-businesses/:id/products/:productId`',
]) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 11b FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 11b OK: owner business workspace + menu/products on the public page, always-visible city-home bar and the WhatsApp-style wall composer, docs/CI in sync');
