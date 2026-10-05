// Structural & security check for Phase 9:
// golden showcase marquee + city-boundary map + storage quota/cleanup.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/web/src/components/showcase-marquee.tsx',
  'apps/web/src/components/showcase-marquee.test.tsx',
  'apps/web/src/components/city-map.tsx',
  'apps/web/src/components/city-map.test.tsx',
  'prisma/migrations/20261005180000_phase9_city_boundary/migration.sql',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: public showcase + map endpoints, guarded admin tools ---
const controller = read('apps/api/src/content/content.controller.ts');
const publicRoutes = ["@Get('showcase')", "@Get('map')"];
for (const route of publicRoutes) {
  if (!controller.includes(route)) { console.error('CONTENT: missing route', route); fail++; }
}
// Each public city route must sit behind @Public (they are pre-login feeds).
for (const route of publicRoutes) {
  const idx = controller.indexOf(route);
  const window = controller.slice(Math.max(0, idx - 220), idx);
  if (!window.includes('@Public()')) { console.error('CONTENT: route not @Public:', route); fail++; }
}

const service = read('apps/api/src/content/content.service.ts');
// Showcase: paid tiers only, approved only, admin-controlled ordering.
for (const marker of [
  "subscriptionTier: { in: ['GOLD', 'SILVER'] }",
  "status: 'APPROVED'",
  'showcaseEnabled',
  "showcasePriority: 'asc'",
]) {
  if (!service.includes(marker)) { console.error(`SHOWCASE: missing ${marker}`); fail++; }
}
// Map: only APPROVED businesses that actually have coordinates.
for (const marker of ['latitude: { not: null }', 'longitude: { not: null }', 'boundary: true']) {
  if (!service.includes(marker)) { console.error(`MAP: missing ${marker}`); fail++; }
}
// The showcase must not leak phone numbers into the marquee payload.
const showcaseSlice = service.slice(service.indexOf('async showcase'), service.indexOf('async map'));
if (showcaseSlice.includes('phone: true')) { console.error('SHOWCASE: phone must not be exposed'); fail++; }

// --- Admin: boundary setter + storage tools are permission-guarded ---
const admin = read('apps/api/src/admin/admin.controller.ts');
const guarded = [
  ["@Post('cities/:id/boundary')", 'map.manage'],
  ["@Get('storage/overview')", 'storage.manage'],
  ["@Post('storage/sweep')", 'storage.manage'],
];
for (const [route, perm] of guarded) {
  const idx = admin.indexOf(route);
  if (idx === -1) { console.error('ADMIN: missing route', route); fail++; continue; }
  const window = admin.slice(idx, idx + 320);
  if (!window.includes(`@RequirePermissions('${perm}')`)) {
    console.error('ADMIN: route without @RequirePermissions:', route);
    fail++;
  }
}

const adminService = read('apps/api/src/admin/admin.service.ts');
for (const marker of ['normalizeBoundary', 'MAX_BOUNDARY_POINTS', 'Prisma.DbNull', "'city.boundary'"]) {
  if (!adminService.includes(marker)) { console.error(`ADMIN: boundary handler missing ${marker}`); fail++; }
}
// Validation must reject non-Polygons and out-of-range coordinates.
for (const marker of ["geo.type !== 'Polygon'", 'lng < -180', 'lat < -90']) {
  if (!adminService.includes(marker)) { console.error(`ADMIN: boundary validation missing ${marker}`); fail++; }
}

// --- Uploads: quota + sweep are actually wired ---
const uploads = read('apps/api/src/uploads/uploads.service.ts');
for (const marker of [
  'MAX_BYTES_PER_USER', // per-user total cap
  'PayloadTooLargeException', // quota rejection
  'async sweep()', // cleanup entry point
  'onModuleInit', // automatic periodic run
  'SWEEP_INTERVAL_MS',
  'entityId: null', // abandoned uploads are swept
  'deletedAt: { not: null', // soft-deleted retention
  'FILE_MIN_AGE_MS', // in-flight upload guard
]) {
  if (!uploads.includes(marker)) { console.error(`UPLOADS: missing ${marker}`); fail++; }
}
// The quota check must run BEFORE any bytes hit the disk.
const quotaIdx = uploads.indexOf('MAX_BYTES_PER_USER >') === -1
  ? uploads.indexOf('usedBytes + buffer.length > MAX_BYTES_PER_USER')
  : uploads.indexOf('MAX_BYTES_PER_USER >');
const writeIdx = uploads.indexOf('await writeFile(');
if (quotaIdx === -1 || writeIdx === -1 || quotaIdx > writeIdx) {
  console.error('UPLOADS: quota must be checked before writing to disk');
  fail++;
}

// --- Schema: boundary column + migration + media ownership for quota ---
const schema = read('prisma/schema.prisma');
for (const marker of ['boundary   Json?', 'sizeBytes', 'ownerUserId', 'deletedAt']) {
  if (!schema.includes(marker)) { console.error(`SCHEMA: missing ${marker}`); fail++; }
}
const migration = read('prisma/migrations/20261005180000_phase9_city_boundary/migration.sql');
if (!migration.includes('ADD COLUMN') || !migration.includes('boundary')) {
  console.error('MIGRATION: cities.boundary column missing');
  fail++;
}
const seed = read('prisma/seed/index.ts');
if (!seed.includes("'storage.manage'")) { console.error('SEED: storage.manage permission missing'); fail++; }

// --- Web: marquee sits above the map, no hard-coded cities ---
const dashboard = read('apps/web/src/components/dashboard.tsx');
const marqueeIdx = dashboard.indexOf('<ShowcaseMarquee');
const mapIdx = dashboard.indexOf('<CityMap');
if (marqueeIdx === -1 || mapIdx === -1 || marqueeIdx > mapIdx) {
  console.error('WEB: golden showcase must be rendered above the city map');
  fail++;
}
const marquee = read('apps/web/src/components/showcase-marquee.tsx');
for (const marker of ['aria-hidden', 'prefers-reduced-motion']) {
  // aria-hidden in component; reduced-motion lives in globals.css (checked below)
  if (marker === 'prefers-reduced-motion') continue;
  if (!marquee.includes(marker)) { console.error(`WEB: marquee missing ${marker}`); fail++;
  }
}
const css = read('apps/web/src/app/globals.css');
for (const marker of ['showcase-marquee', 'translateX(50%)', 'prefers-reduced-motion', 'animation-play-state: paused']) {
  if (!css.includes(marker)) { console.error(`CSS: missing ${marker}`); fail++; }
}
const mapComponent = read('apps/web/src/components/city-map.tsx');
for (const marker of ["await import('leaflet')", 'tile.openstreetmap.org', 'scrollWheelZoom: false']) {
  if (!mapComponent.includes(marker)) { console.error(`MAP UI: missing ${marker}`); fail++; }
}
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getShowcase', 'getCityMap']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing ${helper}`); fail++; }
}

// --- Same multi-city rule: no hard-coded city names anywhere in web src ---
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

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase9')) { console.error('CI: verify:phase9 step missing'); fail++; }
if (!read('package.json').includes('verify:phase9')) { console.error('ROOT: verify:phase9 script missing'); fail++; }
const phase9Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*9\s*\|/.test(l));
if (!phase9Row || !phase9Row.includes('✅')) { console.error('DOCS: phase 9 must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['GET `/showcase?city=<slug>&limit=`', 'GET `/map?city=<slug>`', 'POST `/admin/cities/:id/boundary`', 'POST `/admin/storage/sweep`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 9 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 9 OK: golden showcase marquee above the boundary map, pinned approved businesses, per-user storage quota + sweep, docs/CI in sync');
