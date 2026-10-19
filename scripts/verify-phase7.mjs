// Structural & security check for Phase 7 (Cafe Bazaar in-app billing).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/payments/payments.module.ts',
  'apps/api/src/payments/payments.controller.ts',
  'apps/api/src/payments/payments.service.ts',
  'apps/api/src/payments/payments.dto.ts',
  'apps/api/src/payments/bazaar.service.ts',
  'apps/web/src/components/plans-view.tsx',
  'apps/web/src/components/plans-view.test.tsx',
  'apps/web/src/app/plans/page.tsx',
  'apps/web/src/app/plans/result/page.tsx',
  'apps/web/src/lib/navigation.ts',
];
let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// API routes: plans are public; all purchase/history routes are authenticated.
const controller = read('apps/api/src/payments/payments.controller.ts');
for (const endpoint of [
  "@Get('subscription-plans')",
  "@Post('payments/checkout')",
  "@Post('payments/bazaar/verify')",
  "@Get('payments/mine')",
  "@Get('subscriptions/mine')",
]) {
  if (!controller.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}
if (!/@Public\(\)[\s\S]{0,80}@Get\('subscription-plans'\)/.test(controller)) {
  console.error('SECURITY: GET /subscription-plans must be public'); fail++;
}
for (const route of ["@Post('payments/checkout')", "@Post('payments/bazaar/verify')", "@Get('payments/mine')", "@Get('subscriptions/mine')"]) {
  const index = controller.indexOf(route);
  const before = controller.slice(Math.max(0, index - 120), index);
  if (index < 0 || /@Public\(\)/.test(before)) { console.error('SECURITY: route must require authentication:', route); fail++; }
}

// Verify purchase server-to-server and activate only after Bazaar validation.
const service = read('apps/api/src/payments/payments.service.ts');
for (const marker of [
  'this.bazaar.isConfigured',
  'this.bazaar.verifyPurchase(dto.productId, dto.purchaseToken)',
  "payment.provider !== 'BAZAAR'",
  "status: 'SUCCESS'",
  "status: 'ACTIVE'",
  'MAX_CHECKOUTS_PER_HOUR',
  'payment.userId',
]) {
  if (!service.includes(marker)) { console.error('PAYMENTS: missing', marker); fail++; }
}
const gateway = read('apps/api/src/payments/bazaar.service.ts');
for (const marker of ['BAZAAR_ACCESS_TOKEN', 'BAZAAR_PACKAGE_NAME', 'pardakht.cafebazaar.ir', 'validate/']) {
  if (!gateway.includes(marker)) { console.error('BAZAAR: missing', marker); fail++; }
}
const envExample = read('.env.example');
for (const key of ['BAZAAR_ACCESS_TOKEN', 'BAZAAR_PACKAGE_NAME']) {
  if (!envExample.includes(key)) { console.error('ENV:', key, 'missing from .env.example'); fail++; }
}
const dto = read('apps/api/src/payments/payments.dto.ts');
for (const marker of ['purchaseToken', 'productId', 'paymentId', '@IsNotEmpty()']) {
  if (!dto.includes(marker)) { console.error('DTO: missing', marker); fail++; }
}

// Subscription ownership and schema migration.
const schema = read('prisma/schema.prisma');
if (!/model Subscription \{[\s\S]*?userId\s+Int\s+@map\("user_id"\)/.test(schema)) {
  console.error('SCHEMA: Subscription must carry userId'); fail++;
}
if (!existsSync('prisma/migrations')) { console.error('SCHEMA: migrations folder missing'); fail++; }
else {
  const dirs = readdirSync('prisma/migrations').filter((d) => statSync(`prisma/migrations/${d}`).isDirectory());
  if (!dirs.some((d) => d.includes('phase7_subscription_owner'))) {
    console.error('SCHEMA: phase7 migration missing'); fail++;
  }
}
if (!read('apps/api/src/app.module.ts').includes('PaymentsModule')) {
  console.error('APP: PaymentsModule not registered'); fail++;
}

// Web uses Bazaar bridge and sends the returned purchase token to server verification.
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getPlans', 'checkoutPlan', 'verifyBazaarPurchase', 'getPaymentHistory', 'getMySubscriptions']) {
  if (!apiClient.includes(helper)) { console.error('WEB API: missing', helper); fail++; }
}
const plansView = read('apps/web/src/components/plans-view.tsx');
for (const marker of ['purchaseWithBazaar', 'verifyBazaarPurchase', 'checkoutPlan', 'productId']) {
  if (!plansView.includes(marker)) { console.error('WEB: plans view missing', marker); fail++; }
}
if (!read('apps/web/src/components/showcase-marquee.tsx').includes('href="/referrals"')) {
  console.error('WEB: showcase must offer the ShahrJo referral program'); fail++;
}
if (!read('apps/web/src/app/plans/result/page.tsx').includes('useSearchParams')) {
  console.error('WEB: result page must read the purchase result'); fail++;
}

// No hard-coded city names in frontend/API source.
const hardcoded = ['جم', 'عسلویه', 'شیراز', 'بوشهر', 'کنگان'];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs|js)$/.test(full)) {
      const source = readFileSync(full, 'utf8');
      for (const city of hardcoded) {
        const cityRe = new RegExp(`(?<![\\u0600-\\u06FF])${city}(?![\\u0600-\\u06FF])`);
        if (cityRe.test(source)) { console.error(`HARDCODED city "${city}" in ${full}`); fail++; }
      }
    }
  }
};
walk('apps/web/src');
walk('apps/api/src/payments');

// CI/docs must describe Bazaar, not the retired ZarinPal callback flow.
if (!read('.github/workflows/ci.yml').includes('verify:phase7')) {
  console.error('CI: verify:phase7 step missing'); fail++;
}
if (!read('package.json').includes('verify:phase7')) {
  console.error('ROOT: verify:phase7 script missing'); fail++;
}
const phase7Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*7\s*\|/.test(l));
if (!phase7Row || !phase7Row.includes('✅')) { console.error('DOCS: phase 7 must be marked ✅'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['POST `/payments/checkout`', 'POST `/payments/bazaar/verify`', 'GET `/payments/mine`', 'GET `/subscriptions/mine`']) {
  if (!apiDoc.includes(endpoint)) { console.error('DOCS: endpoint missing:', endpoint); fail++; }
}

if (fail) { console.error(`\nPhase 7 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 7 OK: Cafe Bazaar checkout + server-side token verification, authenticated routes, owned subscriptions, docs/CI in sync');
