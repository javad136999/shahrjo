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
