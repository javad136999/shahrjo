import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const IRAN_MOBILE = /^09\d{9}$/;

/**
 * Normalizes Iranian mobile numbers to canonical `09XXXXXXXXX`.
 * Returns null when the input is not a valid Iranian mobile number.
 */
export function normalizePhone(raw: string): string | null {
  const p = String(raw ?? '').replace(/[\s\-()]/g, '');
  let v = p;
  if (v.startsWith('+98')) v = '0' + v.slice(3);
  else if (v.startsWith('0098')) v = '0' + v.slice(4);
  else if (v.startsWith('98') && v.length === 12) v = '0' + v.slice(2);
  else if (/^9\d{9}$/.test(v)) v = '0' + v;
  return IRAN_MOBILE.test(v) ? v : null;
}

/** Cryptographically secure OTP code of the given digit length. */
export function generateOtpCode(length: number): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
}

/** Peppered HMAC of an OTP: raw codes are never stored. */
export function hmacOtp(secret: string, phone: string, code: string): string {
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

/** Peppered HMAC of an opaque refresh token (stored instead of the token). */
export function hmacToken(secret: string, token: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Timing-safe comparison of two equally sized hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Parses JWT-style durations: `30s`, `15m`, `12h`, `30d`. */
export function parseTtlMs(ttl: string | undefined, fallbackMs: number): number {
  if (!ttl) return fallbackMs;
  const m = /^(\d+)\s*([smhd])$/i.exec(ttl.trim());
  if (!m) return fallbackMs;
  const mult = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2].toLowerCase()] ?? 0;
  return Number(m[1]) * mult || fallbackMs;
}
