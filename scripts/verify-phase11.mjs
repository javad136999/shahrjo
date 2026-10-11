// Structural & security check for Phase 11:
// private messages (1:1 chat started from the city wall — tap a username or
// avatar → profile card → chat), the /messages inbox with image support, the
// bottom-nav messages icon with a red unread badge, and the public-wall nav
// icon counting posts unseen since the user's last visit.
import { existsSync, readFileSync } from 'node:fs';

const mustExist = [
  'apps/api/src/dm/dm.controller.ts',
  'apps/api/src/dm/dm.service.ts',
  'apps/api/src/dm/dm.service.spec.ts',
  'apps/api/src/dm/dm.dto.ts',
  'apps/api/src/dm/dm.module.ts',
  'prisma/migrations/20261011000000_private_chat_wall_read/migration.sql',
  'apps/web/src/app/messages/page.tsx',
  'apps/web/src/app/messages/page.test.tsx',
  'apps/web/src/components/user-profile-modal.tsx',
  'apps/web/src/components/user-profile-modal.test.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: DM routes exist, stay login-only, DTOs are value-imported ---
const controller = read('apps/api/src/dm/dm.controller.ts');
for (const route of [
  "@Get('conversations')",
  "@Post('conversations')",
  "@Get('conversations/:id/messages')",
  "@Post('conversations/:id/messages')",
  "@Get('unread')",
]) {
  if (!controller.includes(route)) { console.error('DM: missing route', route); fail++; }
}
if (controller.includes('@Public()')) { console.error('DM: routes must NOT be @Public (login required)'); fail++; }
if (/import type \{[^}]*Dto/.test(controller)) {
  console.error('DM: controller must value-import its DTOs (no `import type`)'); fail++;
}

// --- API: DM service invariants (pairing, guards, unread pointers) ---
const service = read('apps/api/src/dm/dm.service.ts');
for (const marker of [
  'me < peer ?', // canonical ordering: smaller id is always userA
  'convo.userAId !== userId && convo.userBId !== userId', // participant-only access
  'peerId === user.id', // no self-chat
  "status: 'ACTIVE'", // banned peers are unreachable
  'ownerUserId: user.id', // images must belong to the sender
  'پیام خالی است', // empty message rejected
  'aLastReadAt', // per-user read pointer (badge source)
  'bLastReadAt',
  'senderId: { not: me }', // own messages never count as unread
]) {
  if (!service.includes(marker)) { console.error(`DM SERVICE: missing ${marker}`); fail++; }
}

// --- API: wall unread badge + read tracking ---
const wallController = read('apps/api/src/wall/wall.controller.ts');
for (const route of ["@Get('unread')", "@Post('read')"]) {
  if (!wallController.includes(route)) { console.error('WALL: missing route', route); fail++; }
}
const wallService = read('apps/api/src/wall/wall.service.ts');
for (const marker of ['wallRead.upsert', 'touchRead(user.id, cityId)', 'userId: { not: user.id }']) {
  if (!wallService.includes(marker)) { console.error(`WALL SERVICE: missing ${marker}`); fail++; }
}

// --- API: public profile card must not leak the phone number ---
const usersController = read('apps/api/src/users/users.controller.ts');
if (!usersController.includes("':id/profile'")) { console.error('USERS: missing GET /users/:id/profile'); fail++; }
const usersService = read('apps/api/src/users/users.service.ts');
if (!usersService.includes('getPublicProfile')) { console.error('USERS SERVICE: missing getPublicProfile'); fail++; }
if (/getPublicProfile[\s\S]{0,400}?phone/.test(usersService)) {
  console.error('USERS SERVICE: public profile must not expose the phone number'); fail++;
}

// --- Prisma: schema + migration encode the models ---
const schema = read('prisma/schema.prisma');
for (const marker of ['model PrivateConversation', 'model PrivateMessage', 'model WallRead', '@@unique([userAId, userBId])', '@@id([userId, cityId])']) {
  if (!schema.includes(marker)) { console.error(`PRISMA: missing ${marker}`); fail++; }
}
const migration = read('prisma/migrations/20261011000000_private_chat_wall_read/migration.sql');
for (const marker of ['private_conversations', 'private_messages', 'wall_reads']) {
  if (!migration.includes(marker)) { console.error(`MIGRATION: missing ${marker}`); fail++; }
}

// --- Web: bottom nav carries the messages + wall icons and red badges ---
const bottomNav = read('apps/web/src/components/bottom-nav.tsx');
for (const marker of [
  "'/messages'",
  "'/wall'",
  'bottom-nav__badge',
  'getDmUnread',
  'getWallUnread',
  'getTokens', // signed-out visitors get no badge fetch
]) {
  if (!bottomNav.includes(marker)) { console.error(`WEB bottom-nav: missing ${marker}`); fail++; }
}

// --- Web: wall usernames/avatars open the profile card → private chat ---
const wallView = read('apps/web/src/components/wall-view.tsx');
for (const marker of ['UserProfileModal', 'setProfileUserId(post.user.id)']) {
  if (!wallView.includes(marker)) { console.error(`WEB wall-view: missing ${marker}`); fail++; }
}
const modal = read('apps/web/src/components/user-profile-modal.tsx');
if (!modal.includes('/messages?peer=')) {
  console.error('WEB modal: the chat action must deep-link /messages?peer=<id>'); fail++;
}
if (modal.includes('phone')) {
  console.error('WEB modal: the public profile card must not show the phone number'); fail++;
}

// --- Web: messages page (polling chat, image send, login gate) ---
const messages = read('apps/web/src/app/messages/page.tsx');
for (const marker of [
  'startDm', // ?peer= deep link opens/creates the conversation
  'sendDmMessage',
  'uploadImage', // photo messages
  'getDmMessages',
  'POLL_MS', // REST polling — no WebSocket in this stack
  '/login?next=/messages', // signed-out gate
]) {
  if (!messages.includes(marker)) { console.error(`WEB messages: missing ${marker}`); fail++; }
}

if (fail > 0) {
  console.error(`\nPhase 11 FAILED (${fail} problem${fail === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log('Phase 11 OK — private chat, profile cards, and unread badges are wired.');
