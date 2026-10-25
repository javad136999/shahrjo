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

describe('tourism fallback coverage', () => {
  it('keeps an otherwise unlisted city useful with three distinct starter spots', () => {
    const spots = getTourismSpots({
      id: 999,
      name: 'شهر آزمایشی',
      slug: 'unlisted-city',
      isFeatured: false,
      latitude: 35.7,
      longitude: 51.4,
      province: { id: 99, name: 'استان آزمایشی', slug: 'test' },
    } as City);

    expect(spots).toHaveLength(3);
    expect(new Set(spots.map((spot) => spot.id)).size).toBe(3);
    expect(spots.map((spot) => spot.category)).toEqual(['فرهنگی', 'غذا و بازار', 'تفریحی']);
    expect(spots.every((spot) => spot.sourceUrl === 'https://www.visitiran.ir/')).toBe(true);
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


describe('Tabriz and Yazd tourism additions', () => {
  it('adds eight distinct, mapped Tabriz attractions and labels Kandovan as outside the city', () => {
    const spots = getTourismSpots({ slug: 'tabriz' } as City);
    const additions = spots.filter((spot) => spot.id.startsWith('tabriz-added-'));

    expect(spots).toHaveLength(12);
    expect(additions).toHaveLength(8);
    expect(new Set(spots.map((spot) => spot.id)).size).toBe(spots.length);
    for (const name of ['موزه آذربایجان', 'ارگ علیشاه (ارگ تبریز)', 'موزه قاجار (خانه امیرنظام گروسی)', 'مسجد جامع تبریز', 'کاخ شهرداری تبریز (عمارت ساعت)', 'روستای صخره‌ای کندوان']) {
      expect(spots.some((spot) => spot.name === name)).toBe(true);
    }
    for (const spot of additions) {
      expect(Number.isFinite(spot.latitude)).toBe(true);
      expect(Number.isFinite(spot.longitude)).toBe(true);
      expect(spot.latitude).toBeGreaterThan(37.7);
      expect(spot.latitude).toBeLessThan(38.2);
      expect(spot.longitude).toBeGreaterThan(46.2);
      expect(spot.longitude).toBeLessThan(46.5);
      expect(spot.coordinateSourceUrl).toContain('openstreetmap.org');
    }
    expect(spots.find((spot) => spot.id === 'tabriz-added-kandovan')?.locationLabel).toContain('خارج از شهر');
  });

  it('adds eight distinct, mapped Yazd attractions and labels the Towers of Silence as outside the city', () => {
    const spots = getTourismSpots({ slug: 'yazd' } as City);
    const additions = spots.filter((spot) => spot.id.startsWith('yazd-added-'));

    expect(spots).toHaveLength(12);
    expect(additions).toHaveLength(8);
    expect(new Set(spots.map((spot) => spot.id)).size).toBe(spots.length);
    for (const name of ['میدان امیرچخماق و تکیه', 'زندان اسکندر (مدرسه ضیائیه)', 'موزه آب یزد', 'خانه لاری‌ها', 'بازار خان', 'خانه هنر یزد', 'برج‌های خاموشان (دخمه زرتشتیان)']) {
      expect(spots.some((spot) => spot.name === name)).toBe(true);
    }
    for (const spot of additions) {
      expect(Number.isFinite(spot.latitude)).toBe(true);
      expect(Number.isFinite(spot.longitude)).toBe(true);
      expect(spot.latitude).toBeGreaterThan(31.7);
      expect(spot.latitude).toBeLessThan(32.0);
      expect(spot.longitude).toBeGreaterThan(54.2);
      expect(spot.longitude).toBeLessThan(54.5);
      expect(spot.coordinateSourceUrl).toContain('openstreetmap.org');
    }
    expect(spots.find((spot) => spot.id === 'yazd-added-towers-of-silence')?.locationLabel).toContain('خارج از محدودهٔ شهری');
  });
});


describe('Mashhad and Shiraz tourism additions', () => {
  it('expands Mashhad with distinct, sourced attractions and labels nearby towns', () => {
    const spots = getTourismSpots({ slug: 'mashhad' } as City);
    const additions = spots.filter((spot) => spot.id.startsWith('mashhad-added-'));

    expect(spots).toHaveLength(12);
    expect(additions).toHaveLength(8);
    expect(new Set(spots.map((spot) => spot.id)).size).toBe(spots.length);
    for (const name of ['پارک کوهسنگی', 'پارک ملت مشهد', 'سرزمین موج‌های آبی', 'موزهٔ بزرگ خراسان', 'آرامگاه خواجه ربیع']) {
      expect(spots.some((spot) => spot.name === name)).toBe(true);
    }
    for (const spot of additions) {
      expect(Number.isFinite(spot.latitude)).toBe(true);
      expect(Number.isFinite(spot.longitude)).toBe(true);
      expect(spot.coordinateSourceUrl).toContain('openstreetmap.org');
    }
    expect(spots.find((spot) => spot.id === 'mashhad-added-torghabeh')?.locationLabel).toContain('بیرون از مشهد');
    expect(spots.find((spot) => spot.id === 'mashhad-added-shandiz')?.locationLabel).toContain('بیرون از مشهد');
  });

  it('expands Shiraz with distinct, sourced attractions located in the city', () => {
    const spots = getTourismSpots({ slug: 'shiraz' } as City);
    const additions = spots.filter((spot) => spot.id.startsWith('shiraz-added-'));

    expect(spots).toHaveLength(14);
    expect(additions).toHaveLength(9);
    expect(new Set(spots.map((spot) => spot.id)).size).toBe(spots.length);
    for (const name of ['ارگ کریم‌خان', 'بازار وکیل', 'دروازهٔ قرآن', 'باغ جهان‌نما', 'حرم شاهچراغ']) {
      expect(spots.some((spot) => spot.name === name)).toBe(true);
    }
    for (const spot of additions) {
      expect(Number.isFinite(spot.latitude)).toBe(true);
      expect(Number.isFinite(spot.longitude)).toBe(true);
      expect(spot.latitude).toBeGreaterThan(29.59);
      expect(spot.latitude).toBeLessThan(29.66);
      expect(spot.longitude).toBeGreaterThan(52.48);
      expect(spot.longitude).toBeLessThan(52.58);
      expect(spot.coordinateSourceUrl).toContain('openstreetmap.org');
    }
  });
});
