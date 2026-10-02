import { formatPrice, formatDate, formatRating } from '@/lib/format';

describe('formatPrice', () => {
  it('formats grouped Rial with unit', () => {
    expect(formatPrice(125000000)).toMatch(/ریال$/);
    expect(formatPrice(125000000)).toContain('۱۲۵');
  });

  it('marks null as negotiated', () => {
    expect(formatPrice(null)).toBe('توافقی');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date in fa-IR', () => {
    expect(formatDate('2026-10-01T10:00:00.000Z')).not.toBe('');
  });

  it('returns empty for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('formatRating', () => {
  it('rounds to one decimal and includes the count', () => {
    expect(formatRating(4.26, 3)).toBe('4.3 از 5 (۳ نظر)');
  });

  it('falls back to 0 for nonsense input', () => {
    expect(formatRating(Number.NaN, 0)).toBe('0 از 5 (۰ نظر)');
  });
});
