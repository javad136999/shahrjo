// Structural & security check for Phase 8b:
// city wall (members-only feed + likes + moderation pin), map category filter,
// and post-login redirect straight into the user's own city.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/wall/wall.module.ts',
  'apps/api/src/wall/wall.controller.ts',
  'apps/api/src/wall/wall.service.ts',
  'apps/api/src/wall/wall.dto.ts',
  'apps/api/src/wall/wall.service.spec.ts',
  'prisma/migrations/20261005200000_phase8b_city_wall/migration.sql',
  'apps/web/src/app/wall/page.tsx',
  'apps/web/src/components/wall-view.tsx',
  'apps/web/src/components/wall-view.test.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: wall routes are login-only; pinning needs chat.moderate ---
const controller = read('apps/api/src/wall/wall.controller.ts');
for (const route of ["@Get()", '@Post()', "@Post(':id/like')", "@Delete(':id')", "@Post(':id/pin')"]) {
  if (!controller.includes(route)) { console.error('WALL: missing route', route); fail++; }
}
// The wall is a members' space: no route may be @Public.
if (controller.includes('@Public()')) { console.error('WALL: routes must NOT be @Public (login required)'); fail++; }
// DTOs must be VALUE-imported: `import type` erases them from
// design:paramtypes (emits `Function`), which makes ValidationPipe reject
// every declared property as unknown.
if (/import type \{[^}]*Dto/.test(controller)) {
  console.error('WALL: controller must value-import its DTOs (no `import type`)'); fail++;
}
// Same rule anywhere a DTO type feeds a decorated parameter.
const scanImportType = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) scanImportType(full);
    else if (/\.controller\.ts$/.test(entry)) {
      const text = readFileSync(full, 'utf8');
      if (/import type \{[^}]*Dto/.test(text)) {
        console.error('DTO value-import violation in', full); fail++;
      }
    }
  }
};
scanImportType('apps/api/src');
// Admin body DTOs must be decorated classes (interfaces erase to `Object`
// and ValidationPipe silently skips them).
const adminService = read('apps/api/src/admin/admin.service.ts');
for (const marker of ['export class DecisionDto', 'export class BoundaryDto', 'export class BusinessDecisionDto']) {
  if (!adminService.includes(marker)) { console.error(`ADMIN DTO: ${marker} must be a class`); fail++; }
}
{
  const idx = controller.indexOf("@Post(':id/pin')");
  const window = controller.slice(idx, idx + 260);
  if (idx === -1 || !window.includes("@RequirePermissions('chat.moderate')")) {
    console.error('WALL: pin route must require chat.moderate'); fail++;
  }
}

const service = read('apps/api/src/wall/wall.service.ts');
for (const marker of [
  'MAX_POSTS_PER_MINUTE', // flood guard (429)
  'HttpStatus.TOO_MANY_REQUESTS', // rate-limit rejection
  'replyToId, cityId: city.id', // replies can only target the same city
  "entityType: 'WALL'", // uploaded image is claimed by the post
  'likeCount: { increment: 1 }', // like counter maintained transactionally
  'likeCount: { decrement: 1 }',
  'isPinned: true', // pinned post surfaced first
  'rbac.getScope', // operator scope drives canDelete/canPin
  'canPin: isOperator',
]) {
  if (!service.includes(marker)) { console.error(`WALL SERVICE: missing ${marker}`); fail++; }
}
// The like toggle must run inside a transaction (no lost updates).
const likeIdx = service.indexOf('async toggleLike');
const likeSlice = service.slice(likeIdx, likeIdx + 900);
if (!likeSlice.includes('$transaction')) { console.error('WALL: toggleLike must use a transaction'); fail++; }
// Creating a post must roll the post back if the image claim fails.
const createSlice = service.slice(service.indexOf('async create'), service.indexOf('async toggleLike'));
if (!createSlice.includes('claimed.count !== 1') || !createSlice.includes('wallPost.delete')) {
  console.error('WALL: create must roll back the post when the image claim fails'); fail++;
}

// --- Schema + migration ---
const schema = read('prisma/schema.prisma');
for (const marker of ['model WallPost', 'model WallPostLike', 'isPinned', 'likeCount', 'replyToId']) {
  if (!schema.includes(marker)) { console.error(`SCHEMA: missing ${marker}`); fail++; }
}
const migration = read('prisma/migrations/20261005200000_phase8b_city_wall/migration.sql');
for (const marker of ['"wall_posts"', '"wall_post_likes"', 'FOREIGN KEY']) {
  if (!migration.includes(marker)) { console.error(`MIGRATION: missing ${marker}`); fail++; }
}

// --- Module wiring + uploads sweep covers WALL media ---
if (!read('apps/api/src/app.module.ts').includes('WallModule')) {
  console.error('APP: WallModule not registered'); fail++;
}
const uploads = read('apps/api/src/uploads/uploads.service.ts');
for (const marker of ["in: ['AD', 'WALL']", "entityType === 'WALL'"]) {
  if (!uploads.includes(marker)) { console.error(`UPLOADS: sweep missing ${marker}`); fail++; }
}

// --- Web: wall feed + gate + composer ---
const wallView = read('apps/web/src/components/wall-view.tsx');
for (const marker of [
  'login?next=/wall', // unauthenticated users are sent to login and back
  'err.status === 401',
  'setInterval', // polling until the WebSocket phase lands
  'data-testid="wall-input"', // composer
  'data-testid="wall-send"',
  'data-testid={`wall-post-', // feed cards
]) {
  if (!wallView.includes(marker)) { console.error(`WALL UI: missing ${marker}`); fail++; }
}
const wallPage = read('apps/web/src/app/wall/page.tsx');
if (!wallPage.includes('WallView')) { console.error('WALL PAGE: does not render WallView'); fail++; }

// --- Web: dashboard order — wall hero, then gold showcase, then map ---
const dashboard = read('apps/web/src/components/dashboard.tsx');
const wallIdx = dashboard.indexOf('data-testid="wall-feature"');
const marqueeIdx = dashboard.indexOf('<ShowcaseMarquee');
const mapIdx = dashboard.indexOf('<CityMap');
if (wallIdx === -1 || wallIdx > marqueeIdx || marqueeIdx > mapIdx) {
  console.error('WEB: dashboard must render wall-feature → showcase marquee → map'); fail++;
}
if (!dashboard.includes('data-testid="wall-cta"')) { console.error('WEB: wall CTA missing'); fail++; }

// --- Web: login drops the user straight into their own city ---
const login = read('apps/web/src/components/login-form.tsx');
for (const marker of ['setLocalCity', '`/city/${city.slug}`', "'/users/me'", 'next']) {
  if (!login.includes(marker)) { console.error(`LOGIN: redirect missing ${marker}`); fail++; }
}

// --- Web: map category filter bar above the canvas ---
const mapComponent = read('apps/web/src/components/city-map.tsx');
for (const marker of [
  'data-testid="map-catbtn"',
  'data-testid="map-catmenu"',
  'role="listbox"',
  'activeCat',
  'b.category.slug === activeCat', // only the chosen category's pins remain
  'fitBounds', // view refits after filtering
]) {
  if (!mapComponent.includes(marker)) { console.error(`MAP UI: missing ${marker}`); fail++; }
}
const content = read('apps/api/src/content/content.service.ts');
if (!/category:\s*\{[\s\S]{0,160}slug:\s*true/.test(content)) {
  console.error('CONTENT: map payload must include category.slug'); fail++;
}

// --- Web api client helpers ---
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getWall', 'createWallPost', 'likeWallPost', 'deleteWallPost', 'pinWallPost']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing ${helper}`); fail++; }
}

// --- CSS: wall + JamCity-style category bar ---
const css = read('apps/web/src/app/globals.css');
for (const marker of ['wall-feature', 'wall-feed', 'wall-composer', 'map-catbar', 'map-catbtn', 'map-catmenu']) {
  if (!css.includes(marker)) { console.error(`CSS: missing ${marker}`); fail++; }
}

// --- Same multi-city rule: no hard-coded city names in web or api src ---
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
walk('apps/api/src');

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase8b')) { console.error('CI: verify:phase8b step missing'); fail++; }
if (!read('package.json').includes('verify:phase8b')) { console.error('ROOT: verify:phase8b script missing'); fail++; }
const row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*8b\s*\|/.test(l));
if (!row || !row.includes('✅')) { console.error('DOCS: phase 8b must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['GET `/wall?city=<slug>&limit=&before=`', 'POST `/wall`', 'POST `/wall/:id/pin`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 8b FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 8b OK: city wall (login-only feed, likes, moderated pin), map category filter, login→city redirect, docs/CI in sync');
