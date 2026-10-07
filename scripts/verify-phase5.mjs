// Structural & security check for Phase 5 (Ad submission: form + upload + moderation).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/ads/ads.module.ts',
  'apps/api/src/ads/ads.controller.ts',
  'apps/api/src/ads/ads.service.ts',
  'apps/api/src/ads/ads.dto.ts',
  'apps/api/src/ads/ads.service.spec.ts',
  'apps/api/src/uploads/uploads.module.ts',
  'apps/api/src/uploads/uploads.controller.ts',
  'apps/api/src/uploads/uploads.service.ts',
  'apps/api/src/uploads/uploads.service.spec.ts',
  'apps/web/src/components/ad-form.tsx',
  'apps/web/src/components/ad-form.test.tsx',
  'apps/web/src/app/ads/new/page.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- Backend: submission is authed, city comes from the profile, always PENDING ---
const controller = read('apps/api/src/ads/ads.controller.ts');
for (const endpoint of ["@Post('ads')", "@Get('ads/mine')", "@Get('ad-categories')"]) {
  if (!controller.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}
if (!controller.includes('@Public()') || !/@Public\(\)\s*\n?\s*@Get\('ad-categories'\)/.test(controller)) {
  console.error('SECURITY: only GET /ad-categories may be @Public() in the ads controller');
  fail++;
}
const createHandler = controller.match(/@Post\('ads'\)[\s\S]*?\n  create\(/);
if (!createHandler || createHandler[0].includes('@Public')) {
  console.error('SECURITY: POST /ads must require authentication (never @Public)');
  fail++;
}

const dto = read('apps/api/src/ads/ads.dto.ts');
if (dto.includes('cityId')) {
  console.error('SECURITY: CreateAdDto must NOT accept a cityId (city comes from the profile)');
  fail++;
}
for (const rule of ['@MinLength(4)', '@MinLength(10)', '@ArrayMaxSize(5)', '/^09\\d{9}$/']) {
  if (!dto.includes(rule)) { console.error('VALIDATION: CreateAdDto missing rule', rule); fail++; }
}

const service = read('apps/api/src/ads/ads.service.ts');
for (const marker of ["status: 'PENDING'", 'user.cityId', 'ownerUserId: user.id', 'entityType: \'AD\'', 'MAX_ADS_PER_HOUR', 'Number(price)']) {
  if (!service.includes(marker)) { console.error(`SECURITY: ads service must contain ${marker}`); fail++; }
}
if (service.includes("status: 'APPROVED'") || service.includes("status: 'PUBLISHED'")) {
  console.error('SECURITY: a user-created ad can never be auto-approved/published');
  fail++;
}
if (!service.includes("entityId: null")) {
  console.error('SECURITY: image ownership must only match fresh (unclaimed) uploads');
  fail++;
}

// --- Uploads: never trust the client mimetype, cap size/rate, random storage keys ---
const uploads = read('apps/api/src/uploads/uploads.service.ts');
for (const marker of ['sniffImage', 'MAX_UPLOAD_BYTES', 'MAX_UPLOADS_PER_HOUR', 'randomBytes']) {
  if (!uploads.includes(marker)) { console.error(`UPLOADS: missing ${marker}`); fail++; }
}
// Writes never overwrite silently and stay inside the volume root (storage abstraction).
const localDriver = read('apps/api/src/uploads/storage/local-storage.driver.ts');
if (!localDriver.includes("'wx'")) { console.error("UPLOADS: storage driver must never overwrite silently ('wx')"); fail++; }
if (!localDriver.includes('escapes the volume')) { console.error('UPLOADS: storage driver must block path traversal'); fail++; }
const storageTypes = read('apps/api/src/uploads/storage/storage.types.ts');
if (!storageTypes.includes('interface StorageDriver')) { console.error('STORAGE: StorageDriver abstraction missing (future Object Storage swap)'); fail++; }
if (uploads.includes('file.mimetype') || uploads.includes('file.originalname')) {
  console.error('SECURITY: client-declared mimetype/filename must never be trusted');
  fail++;
}
const uploadsController = read('apps/api/src/uploads/uploads.controller.ts');
if (!uploadsController.includes('limits')) { console.error('UPLOADS: multer must enforce a file size limit'); fail++; }

// Uploaded files are served from the same origin under /api/v1/files/
const main = read('apps/api/src/main.ts');
if (!main.includes('setStaticAssets') && !main.includes('useStaticAssets')) {
  console.error('MAIN: uploaded files must be served (useStaticAssets)');
  fail++;
}
if (!main.includes('/api/v1/files/')) { console.error('MAIN: static prefix must be /api/v1/files/'); fail++; }

const appModule = read('apps/api/src/app.module.ts');
for (const mod of ['AdsModule', 'UploadsModule']) {
  if (!appModule.includes(mod)) { console.error(`MISSING ${mod} in AppModule`); fail++; }
}

// --- Frontend: the form drives upload -> create and shows the moderation result ---
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getAdCategories', 'uploadImage', 'createAd', 'getMyAds']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing helper ${helper}`); fail++; }
}
if (!apiClient.includes('requestForm') || !apiClient.includes('Authorization')) {
  console.error('WEB: multipart upload must still send the Authorization header');
  fail++;
}

const form = read('apps/web/src/components/ad-form.tsx');
for (const marker of ['ارسال برای تأیید', 'type="file"', 'MAX_IMAGES', 'uploadImage', 'createAd', 'ad-status', 'StatusChip']) {
  if (!form.includes(marker)) { console.error(`WEB: ad form missing ${marker}`); fail++; }
}
// the PENDING label lives in the shared status chip (form + profile + detail)
const myAds = read('apps/web/src/components/my-ads.tsx');
if (!myAds.includes('در انتظار تأیید')) {
  console.error('WEB: shared status chip must label PENDING as «در انتظار تأیید»');
  fail++;
}
const formPage = read('apps/web/src/app/ads/new/page.tsx');
if (!formPage.includes('AdForm')) { console.error('WEB: /ads/new must render AdForm'); fail++; }
// The ad-submission entry lives on the right side of the wall composer
// (Phase 10) — the header pill and the bottom-nav item were removed.
const wallView = read('apps/web/src/components/wall-view.tsx');
if (!wallView.includes('data-testid="wall-ad-btn"') || !wallView.includes('/ads/new')) {
  console.error('WEB: wall composer must offer the ad submission entry'); fail++;
}
const headerPills = read('apps/web/src/components/header-pills.tsx');
if (headerPills.includes('/ads/new')) { console.error('WEB: header must NOT link the ad form anymore'); fail++; }

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
walk('apps/api/src/uploads');

// The uploads source folder must stay tracked (.gitignore regression guard).
const gitignore = read('.gitignore');
if (/(^|\n)uploads\/(\n|$)/.test(gitignore)) {
  console.error('GITIGNORE: bare "uploads/" would hide the apps/api/src/uploads source dir');
  fail++;
}
if (!gitignore.includes('/uploads/') || !gitignore.includes('apps/api/uploads/')) {
  console.error('GITIGNORE: runtime upload dir patterns missing');
  fail++;
}

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase5')) { console.error('CI: verify:phase5 step missing'); fail++; }
if (!read('package.json').includes('verify:phase5')) { console.error('ROOT: verify:phase5 script missing'); fail++; }
const phase5Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*5\s*\|/.test(l));
if (!phase5Row || !phase5Row.includes('✅')) { console.error('DOCS: phase 5 must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['POST `/ads`', 'POST `/uploads`', 'GET `/ads/mine`', 'GET `/ad-categories`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 5 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 5 OK: authed ad submission (PENDING), owned uploads with magic-byte checks, form + /ads/new, docs/CI in sync');
