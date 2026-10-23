import { existsSync } from 'node:fs';
import path from 'node:path';
import { getTourismSpots } from '@/lib/tourism';
import type { City } from '@/lib/types';

const citySlugs = [
  'jam',
  'bushehr-city',
  'shiraz',
  'isfahan',
  'yazd',
  'kerman',
  'ahvaz',
  'tehran',
  'mashhad',
  'tabriz',
  'urmia',
  'sanandaj',
  'shahrekord',
  'yasuj',
  'semnan',
  'kangan',
  'ganaveh',
  'borazjan',
  'dayer',
  'jahrom',
  'lar',
  'eghlid',
  'safashahr',
  'marvdasht',
  'sepidan',
  'kazerun',
  'fasa',
  'neyriz',
  'sadra',
  'kashan',
  'khomeyni-shahr',
  'najaf-abad',
  'shahin-shahr',
  'meybod',
  'hamidiya',
  'asaluyeh',
  'abadan',
  'abadeh',
  'ardakan',
  'eslamshahr',
  'bafq',
  'sirjan',
  'rafsanjan',
  'jiroft',
  'bam',
  'dezful',
  'bandar-mahshahr',
  'andimeshk',
  'shahriar',
  'qods',
  'malard',
  'neyshabur',
  'sabzevar',
  'torbat-heydariyeh',
  'kashmar',
  'maragheh',
  'marand',
  'ahar',
  'mianeh',
  'khoy',
  'bukan',
  'mahabad',
  'miandoab',
  'saqqez',
  'marivan',
  'baneh',
  'qorveh',
  'borujen',
  'lordegan',
  'farokh-shahr',
  'farsan',
  'dogonbadan',
  'dehdasht',
  'likak',
  'madavan',
  'shahroud',
  'damghan',
  'garmsar',
  'mehdishahr',
] as const;

describe('tourism coverage for all supported cities', () => {
  it.each(citySlugs)('%s has city-specific spots and at least one usable photo', (slug) => {
    const spots = getTourismSpots({ slug } as City);
    const picturedSpots = spots.filter((spot) => spot.imageUrl);

    expect(spots.length).toBeGreaterThanOrEqual(3);
    expect(picturedSpots.length).toBeGreaterThan(0);
    for (const spot of picturedSpots) {
      expect(existsSync(path.resolve(__dirname, '../../public', spot.imageUrl!.slice(1)))).toBe(true);
    }
  });
});


describe('Isfahan tourism completeness', () => {
  it('includes a broad set of distinct, located city attractions', () => {
    const spots = getTourismSpots({ slug: 'isfahan' } as City);
    expect(spots).toHaveLength(14);
    expect(new Set(spots.map((spot) => spot.id)).size).toBe(spots.length);
    for (const name of ['میدان نقش جهان', 'کاخ عالی‌قاپو', 'مسجد شیخ لطف‌الله', 'پل خواجو', 'کلیسای وانک', 'منارجنبان']) {
      expect(spots.some((spot) => spot.name === name)).toBe(true);
    }
    for (const spot of spots) {
      expect(Number.isFinite(spot.latitude)).toBe(true);
      expect(Number.isFinite(spot.longitude)).toBe(true);
      expect(spot.latitude).toBeGreaterThan(32.4);
      expect(spot.latitude).toBeLessThan(32.9);
      expect(spot.longitude).toBeGreaterThan(51.3);
      expect(spot.longitude).toBeLessThan(52.0);
    }
  });
});
