// Verifies .env exists and required keys are filled (no CHANGE_ME left).
import { readFileSync, existsSync } from 'node:fs';

const required = [
  'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB',
  'DATABASE_URL', 'REDIS_PASSWORD', 'REDIS_URL',
  'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_HASH_SECRET',
];

if (!existsSync('.env')) {
  console.error('FAIL: .env not found. Run: cp .env.example .env');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

let bad = 0;
for (const k of required) {
  if (!env[k]) { console.error(`MISSING: ${k}`); bad++; }
  else if (env[k].includes('CHANGE_ME')) { console.error(`PLACEHOLDER: ${k} still contains CHANGE_ME`); bad++; }
}
if (bad) process.exit(1);
console.log('OK: .env looks good');
