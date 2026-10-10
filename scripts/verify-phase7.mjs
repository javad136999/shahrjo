// Structural & security check for Phase 7 (subscriptions + ZarinPal payments).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const mustExist = [
  'apps/api/src/payments/payments.module.ts',
  'apps/api/src/payments/payments.controller.ts',
  'apps/api/src/payments/payments.service.ts',
  'apps/api/src/payments/payments.dto.ts',
  'apps/api/src/payments/zarinpal.service.ts',
  'apps/api/src/payments/payments.service.spec.ts',
  'apps/web/src/components/plans-view.tsx',
  'apps/web/src/components/plans-view.test.tsx',
  'apps/web/src/app/plans/page.tsx',
  'apps/web/src/app/plans/result/page.tsx',
  'apps/web/src/lib/navigation.ts',
  'apps/web/src/app/business/register/page.tsx',
  'apps/web/src/components/business-registration-form.tsx',
  'apps/web/src/components/business-registration-form.test.tsx',
  'apps/web/src/components/business-location-picker.tsx',
];

let fail = 0;
for (const p of mustExist) if (!existsSync(p)) { console.error('MISSING', p); fail++; }

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- API: endpoints + public/auth split ---
const controller = read('apps/api/src/payments/payments.controller.ts');
for (const endpoint of [
  "@Get('subscription-plans')",
  "@Post('payments/checkout')",
  "@Get('payments/callback')",
  "@Get('payments/mine')",
  "@Get('subscriptions/mine')",
]) {
  if (!controller.includes(endpoint)) { console.error('MISSING endpoint:', endpoint); fail++; }
}
// plans + callback are public; checkout/history must NOT be.
if (!/@Public\(\)[\s\S]{0,80}@Get\('subscription-plans'\)/.test(controller)) {
  console.error('SECURITY: GET /subscription-plans must be @Public');
  fail++;
}
if (!/@Public\(\)[\s\S]{0,80}@Get\('payments\/callback'\)/.test(controller)) {
  console.error('SECURITY: GET /payments/callback must be @Public (gateway redirect, no JWT)');
  fail++;
}
if (/@Public\(\)[\s\S]{0,80}@Post\('payments\/checkout'\)/.test(controller)) {
  console.error('SECURITY: POST /payments/checkout must require auth');
  fail++;
}
if (/@Public\(\)[\s\S]{0,80}@Get\('payments\/mine'\)/.test(controller)) {
  console.error('SECURITY: GET /payments/mine must require auth');
  fail++;
}
// Redirect target must come from config (WEB_URL), never from query input.
if (!controller.includes('WEB_URL')) {
  console.error('SECURITY: callback redirect must use configured WEB_URL (no open redirect)');
  fail++;
}
if (/redirect\(\s*(authorityQuery|statusQuery|req\.) /.test(controller)) {
  console.error('SECURITY: callback must not redirect to a client-supplied URL');
  fail++;
}

const service = read('apps/api/src/payments/payments.service.ts');
// Money rules: verify uses OUR stored amount; success only via verify code 100/101;
// business-bound subscriptions need admin approval; rate cap exists.
for (const marker of [
  'verifyPayment(payment.amount, authority)', // never the query/client amount
  "code !== 100 && verify.code !== 101",
  "'CREATED', 'STARTED'", // status claim guards the double-callback race
  'PENDING_REVIEW',
  'MAX_CHECKOUTS_PER_HOUR',
  'Number(p.price)',
  'Number(updated.amount)',
]) {
  if (!service.includes(marker)) { console.error(`PAYMENTS: missing ${marker}`); fail++; }
}
// A failed gateway request must not leave a live CREATED payment behind.
if (!service.includes("status: 'FAILED'")) {
  console.error('PAYMENTS: gateway failure must mark the payment FAILED');
  fail++;
}

const gateway = read('apps/api/src/payments/zarinpal.service.ts');
for (const marker of ['ZARINPAL_MERCHANT_ID', 'request.json', 'verify.json', 'StartPay', 'sandbox.zarinpal.com', 'payment.zarinpal.com']) {
  if (!gateway.includes(marker)) { console.error(`ZARINPAL: missing ${marker}`); fail++; }
}
// The merchant id must only come from env — never hardcoded.
if (/merchant_id:\s*['"][0-9a-f-]{8,}['"]/i.test(gateway)) {
  console.error('SECURITY: ZarinPal merchant id must not be hardcoded');
  fail++;
}
// Callback URL comes from env too.
const envExample = read('.env.example');
for (const key of ['ZARINPAL_MERCHANT_ID', 'ZARINPAL_SANDBOX', 'ZARINPAL_CALLBACK_URL']) {
  if (!envExample.includes(key)) { console.error(`ENV: ${key} missing from .env.example`); fail++; }
}

// Schema: subscriptions are owned by the paying user (and may be personal).
const schema = read('prisma/schema.prisma');
if (!/model Subscription \{[\s\S]*?userId\s+Int\s+@map\("user_id"\)/.test(schema)) {
  console.error('SCHEMA: Subscription must carry userId');
  fail++;
}
if (!existsSync('prisma/migrations')) { console.error('SCHEMA: migrations folder missing'); fail++; }
const migrationDirs = readdirSync('prisma/migrations').filter((d) => statSync(`prisma/migrations/${d}`).isDirectory());
if (!migrationDirs.some((d) => d.includes('phase7_subscription_owner'))) {
  console.error('SCHEMA: phase7 migration missing');
  fail++;
}

// Registered in the app module.
const appModule = read('apps/api/src/app.module.ts');
if (!appModule.includes('PaymentsModule')) { console.error('APP: PaymentsModule not registered'); fail++; }

// --- Web: helpers, routes, entries ---
const apiClient = read('apps/web/src/lib/api.ts');
for (const helper of ['getPlans', 'checkoutPlan', 'getPaymentHistory', 'getMySubscriptions']) {
  if (!apiClient.includes(helper)) { console.error(`WEB: api client missing ${helper}`); fail++; }
}
const plansView = read('apps/web/src/components/plans-view.tsx');
for (const marker of ['getTokens', 'redirectTo', '/login?next=/plans', 'checkoutPlan', 'payUrl']) {
  if (!plansView.includes(marker)) { console.error(`WEB: plans view missing ${marker}`); fail++; }
}
const businessForm = read('apps/web/src/components/business-registration-form.tsx');
for (const marker of ['getBusinessCategories()', 'createBusiness({', 'checkoutPlan({ planId: Number(planId), businessId: business.id })', '<BusinessLocationPicker', "plan.tier === 'SILVER'", "plan.tier === 'GOLD'", 'ثبت کسب‌وکار']) {
  if (!businessForm.includes(marker)) { console.error(`BUSINESS REGISTRATION: missing ${marker}`); fail++; }
}
if (!read('apps/web/src/app/business/register/page.tsx').includes('BusinessRegistrationForm')) {
  console.error('BUSINESS REGISTRATION: route must render BusinessRegistrationForm'); fail++;
}
// The subscription entry lives on the golden showcase (the header itself
// was slimmed down to news + city + submit).
const showcaseMarquee = read('apps/web/src/components/showcase-marquee.tsx');
if (!showcaseMarquee.includes('/plans')) { console.error('WEB: showcase must offer the subscription entry'); fail++; }
const resultPage = read('apps/web/src/app/plans/result/page.tsx');
if (!resultPage.includes('useSearchParams')) { console.error('WEB: result page must read the callback status'); fail++; }

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
walk('apps/api/src/payments');

// --- CI + docs stay in sync with the phase ---
if (!read('.github/workflows/ci.yml').includes('verify:phase7')) { console.error('CI: verify:phase7 step missing'); fail++; }
if (!read('package.json').includes('verify:phase7')) { console.error('ROOT: verify:phase7 script missing'); fail++; }
const phase7Row = read('docs/architecture.md').split('\n').find((l) => /^\|\s*7\s*\|/.test(l));
if (!phase7Row || !phase7Row.includes('✅')) { console.error('DOCS: phase 7 must be marked ✅ in docs/architecture.md'); fail++; }
const apiDoc = read('docs/api.md');
for (const endpoint of ['GET `/subscription-plans`', 'POST `/payments/checkout`', 'GET `/payments/callback', 'GET `/payments/mine`', 'GET `/subscriptions/mine`']) {
  if (!apiDoc.includes(endpoint)) { console.error(`DOCS: ${endpoint} missing from docs/api.md`); fail++; }
}

if (fail) { console.error(`\nPhase 7 FAILED (${fail} problem${fail > 1 ? 's' : ''})`); process.exit(1); }
console.log('Phase 7 OK: ZarinPal checkout/callback with server-side verify, idempotent claim, owned subscriptions, docs/CI in sync');
