// ShahrJo Phase 2 smoke test.
// Boots the BUILT API (apps/api/dist) against local Postgres/Redis and runs the
// full auth flow: OTP -> verify -> tokens -> refresh rotation -> reuse -> logout.
// Uses unique phones + spoofed X-Forwarded-For IPs so repeated runs never
// collide with Redis rate-limit windows.
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps', 'api');

if (!existsSync(join(apiDir, 'dist', 'main.js'))) {
  console.error('FAIL: apps/api/dist/main.js missing. Run: pnpm --filter @shahrjo/api build');
  process.exit(1);
}

const uniquePhone = () => '09' + Array.from({ length: 9 }, () => randomInt(0, 10)).join('');
const uniqueIp = () => `198.51.${randomInt(0, 256)}.${randomInt(1, 255)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(env) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: apiDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (b) => (out += b.toString()));
  child.stderr.on('data', (b) => (out += b.toString()));
  return { child, getOutput: () => out };
}

async function waitForServer(server, port, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/send-otp`, {
        method: 'OPTIONS',
        headers: { 'X-Forwarded-For': uniqueIp() },
      });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    if (server.child.exitCode !== null) {
      throw new Error(`server :${port} exited with code ${server.child.exitCode}:\n${server.getOutput()}`);
    }
    await sleep(300);
  }
  throw new Error(`server :${port} did not start within ${timeoutMs}ms:\n${server.getOutput()}`);
}

async function request(port, method, path, body, ip, token) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const post = (port, path, body, ip) => request(port, 'POST', path, body, ip);
const get = (port, path, token, ip) => request(port, 'GET', path, undefined, ip, token);

async function waitForOtp(server, phone, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const m = new RegExp(`OTP for ${phone}: (\\d+)`).exec(server.getOutput());
    if (m) return m[1];
    await sleep(100);
  }
  throw new Error(`OTP for ${phone} not found in server output`);
}

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL ${name}${extra ? ` -- ${extra}` : ''}`);
  }
}

const main = startServer({ PORT: '4099' });
const limiter = startServer({ PORT: '4100', OTP_IP_LIMIT_PER_HOUR: '3', OTP_RESEND_COOLDOWN_SECONDS: '0' });

try {
  await waitForServer(main, 4099);
  console.log('--- main flow (:4099) ---');

  const health = await get(4099, '/health', undefined, uniqueIp());
  check('GET /health reports db+redis ok', health.status === 200 && health.json?.data?.checks?.database === true && health.json?.data?.checks?.redis === true, JSON.stringify(health.json));

  const phone = uniquePhone();
  const ip = uniqueIp();

  // 1. send OTP
  const sent = await post(4099, '/auth/send-otp', { phone }, ip);
  check('send-otp returns 200 + envelope', sent.status === 200 && sent.json?.data?.sent === true, JSON.stringify(sent.json));
  const code = await waitForOtp(main, phone);
  check('OTP printed by console SMS provider', /^\d{5}$/.test(code), code);

  // 2. cooldown blocks immediate resend
  const resend = await post(4099, '/auth/send-otp', { phone }, ip);
  check('immediate resend -> 429 RATE_LIMITED', resend.status === 429 && resend.json?.error?.code === 'RATE_LIMITED', JSON.stringify(resend.json));

  // 3. wrong code
  const wrong = await post(4099, '/auth/verify-otp', { phone, code: '00000' }, ip);
  check('wrong code -> 400 INVALID_OTP', wrong.status === 400 && wrong.json?.error?.code === 'INVALID_OTP', JSON.stringify(wrong.json));

  // 4. correct code -> tokens (first login: no city yet)
  const ok = await post(4099, '/auth/verify-otp', { phone, code }, ip);
  const tokens = ok.json?.data;
  check('verify-otp returns tokens + user', ok.status === 200 && Boolean(tokens?.accessToken && tokens?.refreshToken), JSON.stringify(ok.json));
  check('new user has cityId=null (city selection pending)', tokens?.user?.cityId === null);
  check('phone stored normalized', tokens?.user?.phone === phone);

  // 4b. protected routes (JWT guard + users module)
  const meNoAuth = await get(4099, '/users/me', undefined, ip);
  check('GET /users/me without token -> 401 UNAUTHORIZED', meNoAuth.status === 401 && meNoAuth.json?.error?.code === 'UNAUTHORIZED', JSON.stringify(meNoAuth.json));

  const me = await get(4099, '/users/me', tokens.accessToken, ip);
  check('GET /users/me returns profile + roles', me.status === 200 && me.json?.data?.phone === phone && (me.json?.data?.roles ?? []).includes('USER'), JSON.stringify(me.json));
  check('me marks first-run (no city yet)', me.json?.data?.hasSelectedCity === false);

  const patched = await request(4099, 'PATCH', '/users/me', { fullName: 'کاربر تست' }, ip, tokens.accessToken);
  check('PATCH /users/me updates fullName', patched.status === 200 && patched.json?.data?.fullName === 'کاربر تست', JSON.stringify(patched.json));

  const sessions = await get(4099, '/auth/sessions', tokens.accessToken, ip);
  check('GET /auth/sessions lists active sessions', sessions.status === 200 && (sessions.json?.data?.sessions?.length ?? 0) >= 1, JSON.stringify(sessions.json));

  // 5. OTP is one-time use
  const reuse = await post(4099, '/auth/verify-otp', { phone, code }, ip);
  check('re-using consumed OTP -> 400', reuse.status === 400 && reuse.json?.error?.code === 'INVALID_OTP');

  // 6. refresh rotation
  const refreshed = await post(4099, '/auth/refresh', { refreshToken: tokens.refreshToken }, ip);
  check('refresh returns a NEW token pair', refreshed.status === 200 && refreshed.json?.data?.refreshToken !== tokens.refreshToken, JSON.stringify(refreshed.json));

  // 7. old (rotated) token reuse -> family revoked
  const reused = await post(4099, '/auth/refresh', { refreshToken: tokens.refreshToken }, ip);
  check('reusing rotated token -> 401', reused.status === 401 && reused.json?.error?.code === 'INVALID_REFRESH_TOKEN', JSON.stringify(reused.json));

  // 8. logout with the current token
  const out = await post(4099, '/auth/logout', { refreshToken: refreshed.json.data.refreshToken }, ip);
  check('logout -> loggedOut:true', out.status === 200 && out.json?.data?.loggedOut === true, JSON.stringify(out.json));

  const afterLogout = await post(4099, '/auth/refresh', { refreshToken: refreshed.json.data.refreshToken }, ip);
  check('refresh after logout -> 401', afterLogout.status === 401);

  // 9. validation & phone hygiene
  const badPhone = await post(4099, '/auth/send-otp', { phone: '08123456789' }, ip);
  check('invalid phone -> 400 INVALID_PHONE', badPhone.status === 400 && badPhone.json?.error?.code === 'INVALID_PHONE', JSON.stringify(badPhone.json));

  const shortPhone = await post(4099, '/auth/send-otp', { phone: '12345' }, ip);
  check('short phone -> 400 VALIDATION_ERROR', shortPhone.status === 400 && shortPhone.json?.error?.code === 'VALIDATION_ERROR', JSON.stringify(shortPhone.json));

  const extraField = await post(4099, '/auth/send-otp', { phone: uniquePhone(), hack: true }, ip);
  check('unknown body field rejected -> 400', extraField.status === 400, JSON.stringify(extraField.json));

  const missingCode = await post(4099, '/auth/verify-otp', { phone }, ip);
  check('missing code -> 400 validation', missingCode.status === 400, JSON.stringify(missingCode.json));

  // --- IP rate limit instance (:4100, limit=3) ---
  console.log('--- rate limit flow (:4100, IP limit 3/h) ---');
  await waitForServer(limiter, 4100);
  const rlIp = uniqueIp();
  const statuses = [];
  for (let i = 0; i < 4; i++) {
    const r = await post(4100, '/auth/send-otp', { phone: uniquePhone() }, rlIp);
    statuses.push(r.status);
  }
  check('first 3 sends pass the IP limit', statuses.slice(0, 3).every((s) => s === 200), JSON.stringify(statuses));
  check('4th send blocked with 429', statuses[3] === 429, JSON.stringify(statuses));
} catch (err) {
  failures += 1;
  console.error('FAIL unexpected error:', err);
} finally {
  main.child.kill();
  limiter.child.kill();
}

if (failures > 0) {
  console.error(`\nSmoke FAILED (${failures} failing check${failures > 1 ? 's' : ''})`);
  process.exit(1);
}
console.log('\nSmoke PASSED: full auth flow works end-to-end');
