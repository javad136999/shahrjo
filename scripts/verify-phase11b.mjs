// Structural & security check for Phase 11b:
// owner business workspace (profile edit) + menu & products (عکس/مشخصات/قیمت),
// the menu shown on the public business page (map → business entry), the
// always-visible bottom bar on the city home and the WhatsApp-style composer.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/businesses/businesses.menu.spec.ts',
  'apps/api/src/uploads/image.processor.ts',
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

// Normalise line endings: this working tree can check out CRLF (Windows
// autocrlf) while the markers below are written with \n. CI runs on LF, but the
// check must be portable to a dev box too.
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '');

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

// --- Uploads: business photos are compressed hard (disk must not fill) ---
const processor = read('apps/api/src/uploads/image.processor.ts');
for (const marker of [
  'BUSINESS_PROFILE',
  'DISPLAY_PROFILE',
  'fullEdge: 1000',
  'thumbEdge: 320',
  'quality: 72',
  'profile: ImageProfile = DISPLAY_PROFILE',
]) {
  if (!processor.includes(marker)) { console.error(`COMPRESS: missing ${marker}`); fail++; }
}
const uploadsService = read('apps/api/src/uploads/uploads.service.ts');
for (const marker of ['saveBusinessImage', 'storeImage', 'processImage(buffer, profile)', "return this.storeImage(user, file, BUSINESS_PROFILE, 'BUSINESS')"]) {
  if (!uploadsService.includes(marker)) { console.error(`UPLOADS: missing ${marker}`); fail++; }
}
const uploadsController = read('apps/api/src/uploads/uploads.controller.ts');
if (!uploadsController.includes("@Post('uploads/business')")) {
  console.error('UPLOADS: POST /uploads/business route missing');
  fail++;
}
const apiClientFile = read('apps/web/src/lib/api.ts');
if (!apiClientFile.includes("requestForm<UploadedImage>('/uploads/business', form)")) {
  console.error('WEB: uploadBusinessImage must use the compressed business route');
  fail++;
}
if (!apiClientFile.includes('uploadBusinessImage')) {
  console.error('WEB: api client missing uploadBusinessImage');
  fail++;
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

// Owner photos must be the caller's own uploads (no hot-linking) and must be
// claimed so the orphan sweep does not delete them; clearing frees the bytes.
for (const marker of [
  'INTERNAL_FILE_PREFIX',
  'assertOwnedImage',
  'claimImage',
  'releaseImageIfUnused',
  "throw new BadRequestException('فقط عکس‌های آپلودشده در سایت قابل انتخاب هستند')",
  'deletedAt: new Date()',
  'logoUrl',
]) {
  if (!service.includes(marker)) { console.error(`PHOTOS: missing ${marker}`); fail++; }
}
if (!service.includes('imageUrl: url') || !service.includes('usedByProducts > 0 || usedAsLogo > 0')) {
  console.error('PHOTOS: a released image must first be checked for other references');
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
  'uploadBusinessImage', // product photo (compressed route)
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

// Map: compact JamApp-style category markers + the filter docked on the canvas
// corner (no full-width bar above the map any more).
const content = read('apps/api/src/content/content.service.ts');
if (!/logoUrl: true, \/\/ owner photo first/.test(content)) {
  console.error('MAP: the map payload must carry the owner photo');
  fail++;
}
const cityMap = read('apps/web/src/components/city-map.tsx');
for (const marker of ['city-map__frame', 'shahrjo-jam-marker', 'jam-map-marker__body', 'b.category.icon']) {
  if (!cityMap.includes(marker)) { console.error(`MAP: missing ${marker}`); fail++; }
}
// Service actions live in the welcome card; showcase leads into the city map.
const dashboardOrder = read('apps/web/src/components/dashboard.tsx');
const welcomeOrder = dashboardOrder.indexOf('data-testid="dash-welcome"');
const servicesOrder = dashboardOrder.indexOf('<CityServices');
const mapOrder = dashboardOrder.indexOf('<CityMap');
const showcaseOrder = dashboardOrder.indexOf('<ShowcaseMarquee');
if (welcomeOrder === -1 || servicesOrder === -1 || mapOrder === -1 || showcaseOrder === -1 || welcomeOrder > servicesOrder || servicesOrder > showcaseOrder || showcaseOrder > mapOrder) {
  console.error('WEB: city services must sit in welcome card, followed by showcase and map');
  fail++;
}
const cssDock = read('apps/web/src/app/globals.css').includes('.map-catbar {\n  position: absolute;');
if (!cssDock) {
  console.error('CSS: the category dock must float on the map corner');
  fail++;
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

// Composer: WhatsApp-style bar with attach · sticker + input · mic/send flip,
// and the ad entry as a text row *under* the bar (not an icon inside it).
const wallView = read('apps/web/src/components/wall-view.tsx');
for (const marker of [
  'className="wall-bar"',
  'wall-bar__input',
  'wall-bar__emoji',
  'wall-stickers',
  'wall-tool--inline',
  'className="wall-adbtn"',
  'ثبت آگهی فروش',
]) {
  if (!wallView.includes(marker)) { console.error(`WEB wall: missing ${marker}`); fail++; }
}
if (wallView.includes('wall-home-bottom') || wallView.includes('wall-quick__item--home')) {
  console.error('WEB wall: the city-home icon must be gone from the composer dock');
  fail++;
}
// the ad action must sit after the bar's closing tag, i.e. outside the send row
const barBlock = wallView.slice(wallView.indexOf('className="wall-bar"'), wallView.indexOf('className="wall-adbtn"'));
if (!barBlock.includes('</div>\n        )}')) {
  console.error('WEB wall: «ثبت آگهی فروش» must live under the composer bar');
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
