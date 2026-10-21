// Structural & security check for Phase 11c:
// admin suspend/delete of businesses, ad removal from the city wall,
// 2 daily GOLD-business promo posts (morning + evening, random, no repeats),
// the one-week news window (+ cover sweep) and the «اخبار شهر» header pill.
import { existsSync, readFileSync } from 'node:fs';

const mustExist = [
  'prisma/migrations/20261013000000_wall_business_promo/migration.sql',
  'apps/api/src/wall/wall.scheduler.spec.ts',
  'apps/api/src/admin/admin.service.spec.ts',
  'apps/api/src/ads/ads.service.spec.ts',
  'apps/api/src/content/content.service.spec.ts',
  'apps/web/src/components/wall-view.test.tsx',
  'apps/web/src/components/admin-panel.test.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- Prisma: the promo column + FK + index ---
const schema = read('prisma/schema.prisma');
for (const marker of ['businessId Int?    @map("business_id")', 'wallPosts     WallPost[]', '@@index([businessId, createdAt])']) {
  if (!schema.includes(marker)) { console.error(`PRISMA: missing ${marker}`); fail++; }
}
if (!/business Business\? +@relation\(fields: \[businessId\], references: \[id\], onDelete: SetNull\)/.test(schema)) {
  console.error('PRISMA: business relation must be onDelete: SetNull');
  fail++;
}
const migration = read('prisma/migrations/20261013000000_wall_business_promo/migration.sql');
for (const marker of [
  'ALTER TABLE "wall_posts" ADD COLUMN "business_id" INTEGER',
  '"wall_posts_business_id_created_at_idx"',
  'FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL',
]) {
  if (!migration.includes(marker)) { console.error(`MIGRATION: missing ${marker}`); fail++; }
}

// --- Admin: suspend + delete, permission-guarded, scoped, audited ---
const adminController = read('apps/api/src/admin/admin.controller.ts');
for (const marker of [
  "@Post('businesses/:id/suspend')",
  "@Post('businesses/:id/delete')",
  "'businesses.moderate'",
]) {
  if (!adminController.includes(marker)) { console.error(`ADMIN CTRL: missing ${marker}`); fail++; }
}
const adminService = read('apps/api/src/admin/admin.service.ts');
for (const marker of [
  'async suspendBusiness',
  'async deleteBusiness',
  "status: 'CLOSED'",
  "status: 'DELETED'",
  "business.suspend",
  'business.delete',
  "purgeEntity('BUSINESS', id)",
]) {
  if (!adminService.includes(marker)) { console.error(`ADMIN SVC: missing ${marker}`); fail++; }
}
// both must scope by city and write an audit row
for (const fn of ['suspendBusiness', 'deleteBusiness']) {
  const body = adminService.slice(adminService.indexOf(`async ${fn}`));
  if (!body.includes('cityFilter(scope)')) { console.error(`ADMIN: ${fn} is not scope-filtered`); fail++; }
  if (!body.includes('this.audit(')) { console.error(`ADMIN: ${fn} is not audited`); fail++; }
}

// --- Wall: ad removal (owner/moderator) + business promo card ---
const adsService = read('apps/api/src/ads/ads.service.ts');
for (const marker of ['async remove(user: User, id: number)', "data: { status: 'DELETED' }", "purgeEntity('AD', id)"]) {
  if (!adsService.includes(marker)) { console.error(`ADS: missing ${marker}`); fail++; }
}
if (!adsService.includes("if (!isOwner && !scope) throw new ForbiddenException")) {
  console.error('ADS: remove() must allow only the owner or a moderator');
  fail++;
}
const adsController = read('apps/api/src/ads/ads.controller.ts');
if (!adsController.includes("@Delete('ads/:id')")) { console.error('ADS CTRL: DELETE /ads/:id missing'); fail++; }
// @Public must stay on GET /ads/:id (detail), never on the delete route
const deleteIdx = adsController.indexOf("@Delete('ads/:id')");
const detailIdx = adsController.indexOf("@Get('ads/:id')");
if (deleteIdx < 0 || detailIdx < 0 || deleteIdx > detailIdx) {
  console.error('ADS CTRL: route order changed unexpectedly');
  fail++;
}
const publicDecoratorOwner = adsController.slice(0, detailIdx).lastIndexOf('@Public()');
if (publicDecoratorOwner < deleteIdx) {
  console.error('ADS CTRL: @Public() must decorate GET /ads/:id, not the DELETE route');
  fail++;
}
const wallService = read('apps/api/src/wall/wall.service.ts');
for (const marker of ['canRemove: post.ad.userId === viewerId || isOperator', 'business: WallBusinessRef | null']) {
  if (!wallService.includes(marker)) { console.error(`WALL SVC: missing ${marker}`); fail++; }
}
const wallView = read('apps/web/src/components/wall-view.tsx');
for (const marker of ['deleteAd', 'wall-promocard', 'removeAd']) {
  if (!wallView.includes(marker)) { console.error(`WALL UI: missing ${marker}`); fail++; }
}

// --- Scheduler: 2 promos/day (08:00 + 18:00), random, no repeat in a day ---
const scheduler = read('apps/api/src/wall/wall.scheduler.ts');
for (const marker of [
  'promo: 1',
  'async publishPromo',
  'function promoCopy',
  'usedToday',
  'subscriptionTier: ',
  "status: 'APPROVED'",
  'businessId: pick.id',
]) {
  if (!scheduler.includes(marker)) { console.error(`SCHEDULER: missing ${marker}`); fail++; }
}
if (!scheduler.includes('GOLD')) { console.error('SCHEDULER: promos must target GOLD businesses'); fail++; }
const schedSpec = read('apps/api/src/wall/wall.scheduler.spec.ts');
for (const marker of ['GOLD business promos', 'WALL_REPOST_SLOTS.filter((s) => s.promo > 0)', 'toEqual([8, 18])']) {
  if (!schedSpec.includes(marker)) { console.error(`SCHEDULER SPEC: missing ${marker}`); fail++; }
}

// --- News: one-week window + cover sweep; the former news pill now opens tourism ---
const content = read('apps/api/src/content/content.service.ts');
for (const marker of ['NEWS_MAX_AGE_MS', 'newsCutoff', 'newsWindow()', '...this.newsWindow()']) {
  if (!content.includes(marker)) { console.error(`CONTENT: missing ${marker}`); fail++; }
}
const uploads = read('apps/api/src/uploads/uploads.service.ts');
for (const marker of ['newsCutoff()', 'data: { coverUrl: null }', '(2b)']) {
  if (!uploads.includes(marker)) { console.error(`UPLOADS: news-cover sweep missing ${marker}`); fail++; }
}
const headerPills = read('apps/web/src/components/header-pills.tsx');
if (!headerPills.includes('گردشگری شهر') || !headerPills.includes('/tourism')) {
  console.error('HEADER: the former news pill must link to «گردشگری شهر»');
  fail++;
}
const cityNews = read('apps/web/src/components/city-news.tsx');
if (!cityNews.includes('یک هفته')) {
  console.error('NEWS UI: the empty state must explain the one-week window');
  fail++;
}

// --- docs + CI in sync ---
const docs = read('docs/api.md');
for (const marker of ['businesses/:id/suspend', 'businesses/:id/delete', 'DELETE `/ads/:id`', 'پیام تبلیغاتی کسب‌وکارهای طلایی', 'اخبار شهر']) {
  if (!docs.includes(marker)) { console.error(`DOCS: api.md missing ${marker}`); fail++; }
}
if (!read('docs/database.md').includes('wall_posts.business_id')) {
  console.error('DOCS: database.md missing wall_posts.business_id');
  fail++;
}
if (!read('docs/architecture.md').includes('11c')) {
  console.error('DOCS: architecture.md missing the 11c phase row');
  fail++;
}
if (!read('package.json').includes('verify:phase11c')) {
  console.error('ROOT: verify:phase11c script missing');
  fail++;
}
if (!read('.github/workflows/ci.yml').includes('verify:phase11c')) {
  console.error('CI: verify:phase11c step missing');
  fail++;
}

if (fail > 0) {
  console.error(`\nPhase 11c FAILED (${fail} problem${fail === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log(
  'Phase 11c OK: admin suspend/delete (scoped + audited), wall ad removal, ' +
    '2 daily GOLD-business promos, one-week news window + cover sweep, «گردشگری شهر» header pill',
);
