import { formatDate, formatPrice, formatRating, thumbUrlFor } from '@/lib/format';

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

describe('thumbUrlFor — lists load the small variant', () => {
  it('derives the stored thumbnail for our own uploaded files', () => {
    expect(thumbUrlFor('/api/v1/files/media/2026/10/abc.webp')).toBe(
      '/api/v1/files/media/2026/10/abc.thumb.webp',
    );
    expect(thumbUrlFor('/api/v1/files/ads/2026/10/legacy.png')).toBe(
      '/api/v1/files/ads/2026/10/legacy.thumb.webp',
    );
  });

  it('never rewrites foreign URLs and returns null for empty values', () => {
    expect(thumbUrlFor('/files/1.jpg')).toBe('/files/1.jpg'); // news CMS cover
    expect(thumbUrlFor('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    expect(thumbUrlFor(null)).toBeNull();
    expect(thumbUrlFor(undefined)).toBeNull();
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
