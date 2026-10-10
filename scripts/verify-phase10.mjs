// Structural & security check for Phase 10:
// Telegram-style city wall chat room (room header + member count, voice
// notes, inline editing, ad-post entry moved into the composer) and the
// daily ad republication scheduler (2 GOLD + 10 old ads, no repeats).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/wall/wall.scheduler.ts',
  'apps/api/src/wall/wall.scheduler.spec.ts',
  'prisma/migrations/20261008000000_phase10_wall_chat/migration.sql',
  'apps/web/src/components/wall-view.tsx',
  'apps/web/src/components/wall-view.test.tsx',
  'apps/api/src/messages/messages.controller.ts',
  'apps/api/src/messages/messages.dto.ts',
  'apps/api/src/messages/messages.module.ts',
  'apps/api/src/messages/messages.service.ts',
  'apps/api/src/messages/messages.service.spec.ts',
  'apps/web/src/app/messages/page.tsx',
  'apps/web/src/components/messages-view.tsx',
  'apps/web/src/lib/message-read-state.ts',
  'apps/web/src/lib/wall-read-state.ts',
  'prisma/migrations/20261009090000_private_messages/migration.sql',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: wall routes stay login-only; the edit route exists and DTOs are value-imported ---
const controller = read('apps/api/src/wall/wall.controller.ts');
for (const route of ['@Get()', '@Post()', "@Patch(':id')", "@Post(':id/like')", "@Delete(':id')", "@Post(':id/pin')"]) {
  if (!controller.includes(route)) { console.error('WALL: missing route', route); fail++; }
}
if (controller.includes('@Public()')) { console.error('WALL: routes must NOT be @Public (login required)'); fail++; }
if (/import type \{[^}]*Dto/.test(controller)) {
  console.error('WALL: controller must value-import its DTOs (no `import type`)'); fail++;
}

// --- API: chat-room capabilities in the service ---
const service = read('apps/api/src/wall/wall.service.ts');
for (const marker of [
  'voiceUrl', // voice notes on messages
  'editedAt', // edit marker
  'canEdit: post.user.id === viewerId', // only the author edits
  "mimeType: { startsWith: 'audio/' }", // voice claim cannot swallow an image
  'voiceMediaId', // composer uploads are claimed like images
  'claimed.count !== 1', // claim failure rolls the post back
  'wallPost.delete',
  'memberCount', // room header
  'messageCount',
  "`دیوار شهر ${city.name}`", // wall name comes from data — never hard-coded
  'rbac.getScope',
]) {
  if (!service.includes(marker)) { console.error(`WALL SERVICE: missing ${marker}`); fail++; }
}

// --- API: voice upload (magic bytes, 5MB, WALL entity) ---
const uploadsService = read('apps/api/src/uploads/uploads.service.ts');
for (const marker of ['sniffAudio', 'MAX_VOICE_BYTES', "entityType: 'WALL'"]) {
  if (!uploadsService.includes(marker)) { console.error(`UPLOADS: missing ${marker}`); fail++; }
}
const uploadsController = read('apps/api/src/uploads/uploads.controller.ts');
if (!uploadsController.includes("@Post('uploads/voice')")) {
  console.error('UPLOADS: missing POST /uploads/voice'); fail++;
}

// --- Scheduler: slot plan + Tehran clock + no-repeat + eligible pools ---
const scheduler = read('apps/api/src/wall/wall.scheduler.ts');
for (const marker of [
  'WALL_REPOST_SLOTS',
  'TEHRAN_OFFSET_MS',
  'tehranDayStart', // day cursor for «بدون تکرار»
  'adId: { not: null }', // ads already republished today
  "status: 'APPROVED'",
  "tier: 'GOLD'", // GOLD candidates come from active gold subscriptions
  'OLD_AD_MIN_AGE_MS', // «اگهی‌های قدیمی»
  'shuffle', // random selection
  'doneSlots', // each slot fires once per Tehran day
  'REPOST_CHECK_MS',
]) {
  if (!scheduler.includes(marker)) { console.error(`SCHEDULER: missing ${marker}`); fail++; }
}
{
  // `\b` matters: “gold: 1” also contains the literal substring “old: 1”.
  const goldTotal = [...scheduler.matchAll(/\bgold:\s*(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
  const oldTotal = [...scheduler.matchAll(/\bold:\s*(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
  if (goldTotal !== 2) { console.error(`SCHEDULER: expected 2 GOLD reposts/day, found ${goldTotal}`); fail++; }
  if (oldTotal !== 10) { console.error(`SCHEDULER: expected 10 old-ad reposts/day, found ${oldTotal}`); fail++; }
  if (!scheduler.includes('صبح') || !scheduler.includes('عصر')) {
    console.error('SCHEDULER: GOLD slots must cover morning + evening'); fail++;
  }
}

// --- Schema + migration ---
const schema = read('prisma/schema.prisma');
for (const marker of ['model WallPost', 'voiceUrl', 'adId', 'editedAt']) {
  if (!schema.includes(marker)) { console.error(`SCHEMA: missing ${marker}`); fail++; }
}
const migration = read('prisma/migrations/20261008000000_phase10_wall_chat/migration.sql');
for (const marker of ['"voice_url"', '"ad_id"', '"edited_at"', 'wall_posts_ad_id_fkey']) {
  if (!migration.includes(marker)) { console.error(`MIGRATION: missing ${marker}`); fail++; }
}

// --- Private messages: participant-only access, read tracking and anti-spam ---
const messagesController = read('apps/api/src/messages/messages.controller.ts');
for (const route of ["@Get('conversations')", "@Post('conversations')", "@Get('conversations/:id')", "@Post('conversations/:id')", "@Patch('conversations/:id/read')"]) {
  if (!messagesController.includes(route)) { console.error(`MESSAGES: missing route ${route}`); fail++; }
}
if (messagesController.includes('@Public()')) { console.error('MESSAGES: private-message routes must require login'); fail++; }
const messagesService = read('apps/api/src/messages/messages.service.ts');
for (const marker of ['requireMember', 'RateLimiterService', 'MAX_DIRECT_MESSAGES_PER_MINUTE', 'markRead']) {
  if (!messagesService.includes(marker)) { console.error(`MESSAGES: missing ${marker}`); fail++; }
}
const privateMigration = read('prisma/migrations/20261009090000_private_messages/migration.sql');
for (const marker of ['"direct_conversations"', '"direct_messages"', 'FOREIGN KEY', 'direct_conversations_users_ordered_check']) {
  if (!privateMigration.includes(marker)) { console.error(`PRIVATE MESSAGE MIGRATION: missing ${marker}`); fail++; }
}
const privateSchema = read('prisma/schema.prisma');
for (const marker of ['model DirectConversation', 'model DirectMessage']) {
  if (!privateSchema.includes(marker)) { console.error(`PRIVATE MESSAGE SCHEMA: missing ${marker}`); fail++; }
}
const messagesView = read('apps/web/src/components/messages-view.tsx');
for (const marker of ['getConversations', 'getConversationMessages', 'sendDirectMessage', 'notifyPrivateMessagesRead']) {
  if (!messagesView.includes(marker)) { console.error(`MESSAGES UI: missing ${marker}`); fail++; }
}
const messageReadState = read('apps/web/src/lib/message-read-state.ts');
if (!messageReadState.includes('PRIVATE_MESSAGES_READ_EVENT')) { console.error('MESSAGES UI: read event missing'); fail++; }
const bottomNavChecks = read('apps/web/src/components/bottom-nav.tsx');
for (const marker of ['/wall', '/messages', '/business/register', 'getWallUnread', 'getConversations', 'bottom-nav__badge']) {
  if (!bottomNavChecks.includes(marker)) { console.error(`BOTTOM NAV: missing ${marker}`); fail++; }
}

// --- Web: the chat room ---
const wallView = read('apps/web/src/components/wall-view.tsx');
for (const marker of [
  'data-testid="wall-room"', // room header
  'data-testid="wall-room-members"',
  'feed.room.name', // wall name from the API
  'data-testid="wall-ad-btn"', // ad-post entry, right side of the composer
  'MediaRecorder', // voice notes
  'voiceMediaId', // composer → API claim
  'editWallPost', // inline editing
  'data-testid="wall-input"',
  'data-testid="wall-send"',
  'data-testid={`wall-post-',
  'setInterval', // live delivery via polling
  'login?next=/wall',
  'err.status === 401',
]) {
  if (!wallView.includes(marker)) { console.error(`WALL UI: missing ${marker}`); fail++; }
}

// The ad entry must exist ONLY in the wall composer now.
const headerPills = read('apps/web/src/components/header-pills.tsx');
if (headerPills.includes('/ads/new')) { console.error('WEB: header still links /ads/new'); fail++; }
const bottomNav = read('apps/web/src/components/bottom-nav.tsx');
if (bottomNav.includes('/ads/new')) { console.error('WEB: bottom nav still links /ads/new'); fail++; }

// Web api client helpers.
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['uploadVoice', 'editWallPost', 'createWallPost', 'getWall']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing ${helper}`); fail++; }
}

// CSS for the room UI.
const css = read('apps/web/src/app/globals.css');
for (const marker of ['.wall-room', '.wall-adcard', '.wall-adbtn', '.wall-rec', '.wall-edit']) {
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
if (!read('.github/workflows/ci.yml').includes('verify:phase10')) { console.error('CI: verify:phase10 step missing'); fail++; }
if (!read('package.json').includes('verify:phase10')) { console.error('ROOT: verify:phase10 script missing'); fail++; }
const phase10Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*10\s*\|/.test(l));
if (!phase10Row || !phase10Row.includes('✅')) { console.error('DOCS: phase 10 must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['PATCH `/wall/:id`', 'POST `/uploads/voice`', 'GET `/wall?city=<slug>&limit=&before=`', 'GET `/wall/unread?city=<slug>&after=<ISO8601>`', 'GET `/messages/conversations`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 10 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 10 OK: city wall + private inbox (access checks, unread badges, rate limits) + daily ad republication, docs/CI in sync');
