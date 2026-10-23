import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isCoordinateInCity } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';

const OVERPASS_INTERPRETER_URL = 'https://overpass.private.coffee/api/interpreter';
const CITY_MAP_AMENITY_CACHE_MS = 6 * 60 * 60 * 1000;
const CITY_MAP_AMENITY_ERROR_CACHE_MS = 60 * 1000;
const CITY_MAP_AMENITY_TIMEOUT_MS = 8_000;

export type CityMapAmenityKind = 'hospital' | 'clinic' | 'parking';

export interface CityMapAmenity {
  id: string;
  kind: CityMapAmenityKind;
  name: string;
  latitude: number;
  longitude: number;
}

interface OverpassAmenityElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

interface MapAmenityCity {
  slug: string;
  latitude: number | null;
  longitude: number | null;
  boundary: unknown;
}

function collectBoundaryPositions(value: unknown, positions: [number, number][]): void {
  if (Array.isArray(value)) {
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push([value[0], value[1]]);
      return;
    }
    for (const child of value) collectBoundaryPositions(child, positions);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) collectBoundaryPositions(child, positions);
  }
}

/** Overpass bbox order is south, west, north, east; match the city pin fallback. */
function cityMapAmenityBbox(city: MapAmenityCity): string | null {
  const positions: [number, number][] = [];
  collectBoundaryPositions(city.boundary, positions);

  let south: number;
  let west: number;
  let north: number;
  let east: number;
  if (positions.length >= 3) {
    const latitudes = positions.map(([, lat]) => lat);
    const longitudes = positions.map(([lng]) => lng);
    south = Math.min(...latitudes);
    west = Math.min(...longitudes);
    north = Math.max(...latitudes);
    east = Math.max(...longitudes);
  } else if (city.latitude !== null && city.longitude !== null) {
    south = city.latitude - 0.15;
    west = city.longitude - 0.15;
    north = city.latitude + 0.15;
    east = city.longitude + 0.15;
  } else {
    return null;
  }

  if (![south, west, north, east].every(Number.isFinite) || south >= north || west >= east) return null;
  return [south, west, north, east].map((coordinate) => coordinate.toFixed(6)).join(',');
}

function cityMapAmenityKind(tags: Record<string, unknown>): CityMapAmenityKind | null {
  const amenity = typeof tags.amenity === 'string' ? tags.amenity.toLowerCase() : '';
  const healthcare = typeof tags.healthcare === 'string' ? tags.healthcare.toLowerCase() : '';
  if (amenity === 'parking') return 'parking';
  if (amenity === 'hospital' || healthcare === 'hospital') return 'hospital';
  if (amenity === 'clinic' || healthcare === 'clinic') return 'clinic';
  return null;
}

export const DEFAULT_CONTENT_LIMIT = 12;

/**
 * Only the last week of a city's news is published to the site (فاز ۱۱b):
 * older stories leave the feed AND their detail page 404s, so the 📰 icon
 * always shows fresh news. Rows stay in the database for the audit trail —
 * they are simply never served again.
 */
export const NEWS_MAX_AGE_MS = 7 * 86_400_000;

/** Where the one-week window starts (published date, falling back to creation). */
export function newsCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - NEWS_MAX_AGE_MS);
}

export interface NewsItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
}

export interface AdItem {
  id: number;
  title: string;
  /** Rial — BigInt in Postgres, Number on the wire (safe: Rial amounts fit). */
  price: number | null;
  coverUrl: string | null;
  viewCount: number;
  publishedAt: Date | null;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

export interface BusinessItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  rating: number;
  ratingCount: number;
  subscriptionTier: string;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

/** Compact public preview of one approved business that has menu products. */
export interface MenuShowcaseItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  subscriptionTier: string;
  category: { name: string; slug: string; icon: string | null; color: string | null };
  products: { id: number; name: string; price: number | null; imageUrl: string | null; isAvailable: boolean }[];
}

/** One paid-tier business card of the golden showcase. */
export interface ShowcaseItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  rating: number;
  ratingCount: number;
  subscriptionTier: string;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

/** City map payload: center + boundary (GeoJSON) + approved business pins. */
export interface CityMapData {
  city: {
    id: number;
    name: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
    boundary: unknown | null;
  };
  businesses: Array<{
    id: number;
    name: string;
    slug: string;
    latitude: number;
    longitude: number;
    subscriptionTier: string;
    /** Real business photo — the pin shows it instead of the category icon. */
    logoUrl: string | null;
    category: { name: string; slug: string; icon: string | null; color: string | null };
  }>;
  amenities: CityMapAmenity[];
}

export interface NewsDetail extends NewsItem {
  body: string;
  viewCount: number;
  city: { name: string; slug: string };
}

/** One menu/product row of a business, as the public profile shows it. */
export interface BusinessProductItem {
  id: number;
  name: string;
  description: string | null;
  /** Rial — null = «توافقی». */
  price: number | null;
  imageUrl: string | null;
  /** Free-text menu group («نوشیدنی»، «غذاهای اصلی»…) — null = بدون دسته. */
  section: string | null;
  isAvailable: boolean;
}

export interface BusinessDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  workingHours: unknown;
  socialLinks: unknown;
  rating: number;
  ratingCount: number;
  viewCount: number;
  subscriptionTier: string;
  createdAt: Date;
  city: { name: string; slug: string };
  category: { name: string; slug: string; icon: string | null; color: string | null };
  /** Menu & products («منو و محصولات») — empty array when none registered. */
  products: BusinessProductItem[];
}

/**
 * Read-only public feeds of a single city for the dashboard (Phase 4).
 * Every query is scoped by a resolved active city and by the public-facing
 * status only — drafts/pending/rejected content never leaves the API.
 */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly cityMapAmenityCache = new Map<string, { expiresAt: number; promise: Promise<CityMapAmenity[]> }>();

  /**
   * The one-week window filter. `publishedAt` is the timestamp that counts;
   * a row published without one falls back to its creation time so it is
   * never silently hidden while fresh.
   */
  private newsWindow(): Prisma.NewsWhereInput {
    const cutoff = newsCutoff();
    return {
      OR: [{ publishedAt: { gte: cutoff } }, { publishedAt: null, createdAt: { gte: cutoff } }],
    };
  }

  /** slug -> id, only for active cities of active provinces (404 otherwise). */
  private async resolveCity(slug: string): Promise<number> {
    const city = await this.prisma.city.findFirst({
      where: { slug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر یافت نشد');
    return city.id;
  }

  async news(citySlug: string, limit: number = DEFAULT_CONTENT_LIMIT): Promise<NewsItem[]> {
    const cityId = await this.resolveCity(citySlug);
    return this.prisma.news.findMany({
      // one week of this city's news — nothing older is published
      where: { cityId, status: 'PUBLISHED', ...this.newsWindow() },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        publishedAt: true,
        category: { select: { name: true, slug: true } },
      },
    });
  }

  async ads(
    citySlug: string,
    limit: number = DEFAULT_CONTENT_LIMIT,
    categorySlug?: string,
  ): Promise<AdItem[]> {
    const cityId = await this.resolveCity(citySlug);
    const rows = await this.prisma.ad.findMany({
      where: {
        cityId,
        status: 'APPROVED',
        // category shortcut of the chat room (optional filter)
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        // never surface expired listings even if the nightly sweep has not run yet
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        price: true,
        viewCount: true,
        publishedAt: true,
        category: { select: { name: true, slug: true, icon: true, color: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
      },
    });

    return rows.map(({ images, price, ...rest }) => ({
      ...rest,
      // BigInt is not JSON-serializable — convert once, here.
      price: price === null ? null : Number(price),
      coverUrl: images[0]?.url ?? null,
    }));
  }

  /**
   * Approved businesses of one city (showcase order), optionally narrowed to a
   * single category — the city-home service desk («چه خدماتی نیاز داری») uses
   * that filter to list the trades of the chosen service.
   */
  async businesses(
    citySlug: string,
    limit: number = DEFAULT_CONTENT_LIMIT,
    categorySlug?: string,
  ): Promise<BusinessItem[]> {
    const cityId = await this.resolveCity(citySlug);
    return this.prisma.business.findMany({
      where: {
        cityId,
        status: 'APPROVED',
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      // showcase order: lower priority first (gold showcase), then best rated
      orderBy: [{ showcasePriority: 'asc' }, { rating: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        phone: true,
        rating: true,
        ratingCount: true,
        subscriptionTier: true,
        category: { select: { name: true, slug: true, icon: true, color: true } },
      },
    });
  }

  /** Approved businesses with registered menus and two lightweight product previews. */
  async menuShowcase(citySlug: string, limit: number = DEFAULT_CONTENT_LIMIT): Promise<MenuShowcaseItem[]> {
    const cityId = await this.resolveCity(citySlug);
    const rows = await this.prisma.business.findMany({
      where: { cityId, status: 'APPROVED', products: { some: {} } },
      orderBy: [{ showcasePriority: 'asc' }, { rating: 'desc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        subscriptionTier: true,
        category: { select: { name: true, slug: true, icon: true, color: true } },
        products: {
          orderBy: [{ isAvailable: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
          take: 2,
          select: { id: true, name: true, price: true, imageUrl: true, isAvailable: true },
        },
      },
    });
    return rows.map(({ products, ...business }) => ({
      ...business,
      products: products.map(({ price, ...product }) => ({
        ...product,
        price: price === null ? null : Number(price),
      })),
    }));
  }

  /**
   * Golden showcase (Phase 9): approved GOLD/SILVER businesses of a city,
   * ordered by showcasePriority (admin-set; gold first) then rating.
   * Feeds the animated marquee panel above the city map.
   */
  async showcase(citySlug: string, limit: number = DEFAULT_CONTENT_LIMIT): Promise<ShowcaseItem[]> {
    const cityId = await this.resolveCity(citySlug);
    return this.prisma.business.findMany({
      where: {
        cityId,
        status: 'APPROVED',
        subscriptionTier: { in: ['GOLD', 'SILVER'] },
        showcaseEnabled: true,
      },
      orderBy: [{ showcasePriority: 'asc' }, { rating: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        rating: true,
        ratingCount: true,
        subscriptionTier: true,
        category: { select: { name: true, slug: true, icon: true, color: true } },
      },
    });
  }

  /**
   * City map (Phase 9): the boundary (GeoJSON Polygon when the admin set one,
   * otherwise null → client draws a circle around the center) plus every
   * APPROVED business that has coordinates (pins are stored on approval).
   * Only pinned businesses leave the API — a business without a pin simply
   * does not appear on the map.
   */
  async map(citySlug: string): Promise<CityMapData> {
    const city = await this.prisma.city.findFirst({
      where: { slug: citySlug, isActive: true, province: { isActive: true } },
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        boundary: true,
      },
    });
    if (!city) throw new NotFoundException('شهر یافت نشد');

    const businessesPromise = this.prisma.business.findMany({
      where: { cityId: city.id, status: 'APPROVED', latitude: { not: null }, longitude: { not: null } },
      orderBy: [{ showcasePriority: 'asc' }, { rating: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        subscriptionTier: true,
        logoUrl: true, // owner photo first, category icon as the fallback
        category: { select: { name: true, slug: true, icon: true, color: true } },
      },
    });

    const [businesses, amenities] = await Promise.all([businessesPromise, this.cityMapAmenities(city)]);

    return {
      city,
      // Legacy rows can predate city pin validation, and direct DB/imported
      // data can bypass DTO checks. Never let such a row move another city's
      // map frame or create an invalid Leaflet marker.
      businesses: businesses
        .filter((b) => b.latitude !== null && b.longitude !== null && isCoordinateInCity(city, b.latitude, b.longitude))
        .map((b) => ({
        ...b,
        latitude: b.latitude as number,
        longitude: b.longitude as number,
        })),
      amenities,
    };
  }

  private cityMapAmenities(city: MapAmenityCity): Promise<CityMapAmenity[]> {
    const bbox = cityMapAmenityBbox(city);
    if (!bbox) return Promise.resolve([]);

    const key = `${city.slug}:${bbox}`;
    const cached = this.cityMapAmenityCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = this.fetchCityMapAmenities(city, bbox)
      .then((amenities) => {
        this.cityMapAmenityCache.set(key, {
          expiresAt: Date.now() + CITY_MAP_AMENITY_CACHE_MS,
          promise: Promise.resolve(amenities),
        });
        return amenities;
      })
      .catch(() => {
        const empty = Promise.resolve([] as CityMapAmenity[]);
        this.cityMapAmenityCache.set(key, {
          expiresAt: Date.now() + CITY_MAP_AMENITY_ERROR_CACHE_MS,
          promise: empty,
        });
        return empty;
      });

    // Keep the in-flight request so simultaneous visitors share one Overpass query.
    this.cityMapAmenityCache.set(key, {
      expiresAt: Date.now() + CITY_MAP_AMENITY_CACHE_MS,
      promise,
    });
    return promise;
  }

  private async fetchCityMapAmenities(city: MapAmenityCity, bbox: string): Promise<CityMapAmenity[]> {
    const query =
      `[out:json][timeout:6][maxsize:12000000];\n` +
      `(\n` +
      `  nwr["amenity"~"^(hospital|clinic|parking)$"](${bbox});\n` +
      `  nwr["healthcare"~"^(hospital|clinic)$"](${bbox});\n` +
      `);\n` +
      `out center tags;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CITY_MAP_AMENITY_TIMEOUT_MS);

    try {
      const response = await fetch(OVERPASS_INTERPRETER_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'user-agent': 'ShahrJo/1.0 (+https://shahrju.ir)',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass returned HTTP ${response.status}`);

      const payload = (await response.json()) as { elements?: OverpassAmenityElement[] };
      if (!Array.isArray(payload.elements)) return [];

      const amenities: CityMapAmenity[] = [];
      for (const element of payload.elements) {
        const tags = typeof element.tags === 'object' && element.tags !== null ? element.tags : {};
        const kind = cityMapAmenityKind(tags);
        if (!kind) continue;

        const latitude = typeof element.center?.lat === 'number' ? element.center.lat :
          typeof element.lat === 'number' ? element.lat : Number.NaN;
        const longitude = typeof element.center?.lon === 'number' ? element.center.lon :
          typeof element.lon === 'number' ? element.lon : Number.NaN;
        if (!isCoordinateInCity(city, latitude, longitude)) continue;

        const fallbackName = kind === 'hospital' ? 'بیمارستان' : kind === 'clinic' ? 'درمانگاه' : 'پارکینگ';
        const name = [tags['name:fa'], tags.name, tags['name:en']].find(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )?.trim() ?? fallbackName;
        const elementType = element.type === 'way' || element.type === 'relation' ? element.type : 'node';
        const id = typeof element.id === 'number' ? `${elementType}/${element.id}` : `${elementType}/${latitude}/${longitude}`;
        amenities.push({ id, kind, name, latitude, longitude });
      }

      return amenities;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** A single published news article + view counting (Phase 6). */
  async newsDetail(slug: string): Promise<NewsDetail> {
    const item = await this.prisma.news.findFirst({
      // older than the week? it is out of the site — same 404 as unknown slugs
      where: { slug, status: 'PUBLISHED', ...this.newsWindow() },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        body: true,
        coverUrl: true,
        viewCount: true,
        publishedAt: true,
        city: { select: { name: true, slug: true } },
        category: { select: { name: true, slug: true } },
      },
    });
    if (!item) throw new NotFoundException('خبر یافت نشد');

    const updated = await this.prisma.news.update({
      where: { id: item.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    return { ...item, viewCount: updated.viewCount };
  }

  /** A single approved business profile + view counting (Phase 6). */
  async businessDetail(id: number): Promise<BusinessDetail> {
    const business = await this.prisma.business.findFirst({
      where: { id, status: 'APPROVED' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        workingHours: true,
        socialLinks: true,
        rating: true,
        ratingCount: true,
        viewCount: true,
        subscriptionTier: true,
        createdAt: true,
        city: { select: { name: true, slug: true } },
        category: { select: { name: true, slug: true, icon: true, color: true } },
        // The owner's menu rows travel with the profile so the map → business
        // entry shows the products without a second request.
        products: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            section: true,
            isAvailable: true,
          },
        },
      },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const updated = await this.prisma.business.update({
      where: { id: business.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    const { products, ...rest } = business;
    return {
      ...rest,
      viewCount: updated.viewCount,
      products: products.map((product) => ({
        ...product,
        price: product.price === null ? null : Number(product.price),
      })),
    };
  }
}
