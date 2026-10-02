import {
  generateOtpCode,
  hmacOtp,
  hmacToken,
  normalizePhone,
  parseTtlMs,
  safeEqualHex,
  sha256Hex,
} from './utils';

describe('normalizePhone', () => {
  it.each([
    ['09123456789', '09123456789'],
    ['9123456789', '09123456789'],
    ['+989123456789', '09123456789'],
    ['00989123456789', '09123456789'],
    ['989123456789', '09123456789'],
    ['0912 345-6789', '09123456789'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '123', '0912345678', '08123456789', '091234567890', 'abc', '0912345678a', '98123456789'])(
    'rejects invalid %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('generateOtpCode', () => {
  it('generates codes of the requested digit length', () => {
    expect(generateOtpCode(5)).toMatch(/^\d{5}$/);
    expect(generateOtpCode(6)).toMatch(/^\d{6}$/);
  });
});

describe('hmacOtp / hmacToken', () => {
  it('is deterministic for the same inputs', () => {
    expect(hmacOtp('pepper', '09123456789', '12345')).toBe(hmacOtp('pepper', '09123456789', '12345'));
  });

  it('differs when code, phone, or pepper changes', () => {
    const base = hmacOtp('pepper', '09123456789', '12345');
    expect(hmacOtp('pepper', '09123456789', '12346')).not.toBe(base);
    expect(hmacOtp('pepper', '09123456788', '12345')).not.toBe(base);
    expect(hmacOtp('other', '09123456789', '12345')).not.toBe(base);
  });

  it('produces a 64-char hex digest that never contains the raw code', () => {
    const code = '12345';
    const digest = hmacOtp('pepper', '09123456789', code);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(code);
  });

  it('hashes refresh tokens differently from the raw token', () => {
    const token = 'rt_abcdef0123456789';
    expect(hmacToken('secret', token)).not.toContain(token);
    expect(hmacToken('secret', token)).toBe(hmacToken('secret', token));
  });
});

describe('safeEqualHex', () => {
  it('compares equal-length digests', () => {
    expect(safeEqualHex('abc123', 'abc123')).toBe(true);
    expect(safeEqualHex('abc123', 'abc124')).toBe(false);
    expect(safeEqualHex('abc123', 'abc1234')).toBe(false);
  });
});

describe('parseTtlMs', () => {
  it('parses JWT-style durations', () => {
    expect(parseTtlMs('30s', 0)).toBe(30_000);
    expect(parseTtlMs('15m', 0)).toBe(900_000);
    expect(parseTtlMs('12h', 0)).toBe(43_200_000);
    expect(parseTtlMs('30d', 0)).toBe(2_592_000_000);
  });

  it('falls back on missing or invalid values', () => {
    expect(parseTtlMs(undefined, 42)).toBe(42);
    expect(parseTtlMs('nope', 42)).toBe(42);
    expect(parseTtlMs('5', 42)).toBe(42);
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
