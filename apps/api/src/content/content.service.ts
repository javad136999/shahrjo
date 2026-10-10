import { randomUUID } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './business.dto';

export const DEFAULT_CONTENT_LIMIT = 12;
const MAX_BUSINESSES_PER_DAY = 5;

export interface BusinessCategoryItem {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

export interface CreatedBusiness {
  id: number;
  name: string;
  status: string;
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
    category: { name: string; slug: string; icon: string | null; color: string | null };
  }>;
}

export interface NewsDetail extends NewsItem {
  body: string;
  viewCount: number;
  city: { name: string; slug: string };
}

export interface BusinessDetail {
  id: number;
  ownerId: number;
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
}

/**
 * Read-only public feeds of a single city for the dashboard (Phase 4).
 * Every query is scoped by a resolved active city and by the public-facing
 * status only — drafts/pending/rejected content never leaves the API.
 */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active business categories available to the registration form. */
  async businessCategories(): Promise<BusinessCategoryItem[]> {
    return this.prisma.businessCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, icon: true, color: true },
    });
  }

  /** Create a pending business; city and owner are never trusted from the client. */
  async createBusiness(user: User, dto: CreateBusinessDto): Promise<CreatedBusiness> {
    if (!user.cityId) throw new BadRequestException('ابتدا شهر خودت را انتخاب کن');

    const city = await this.prisma.city.findFirst({
      where: { id: user.cityId, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('دسته‌بندی کسب‌وکار یافت نشد');

    const dayAgo = new Date(Date.now() - 86_400_000);
    const recent = await this.prisma.business.count({
      where: { ownerId: user.id, createdAt: { gte: dayAgo } },
    });
    if (recent >= MAX_BUSINESSES_PER_DAY) {
      throw new HttpException('سقف ثبت کسب‌وکار روزانه پر شده است؛ فردا دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }

    return this.prisma.business.create({
      data: {
        cityId: city.id,
        ownerId: user.id,
        categoryId: category.id,
        name: dto.name,
        slug: `business-${city.id}-${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        description: dto.description || null,
        phone: dto.phone || null,
        address: dto.address || null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: 'PENDING',
      },
      select: { id: true, name: true, status: true },
    });
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
      where: { cityId, status: 'PUBLISHED' },
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

  async ads(citySlug: string, limit: number = DEFAULT_CONTENT_LIMIT): Promise<AdItem[]> {
    const cityId = await this.resolveCity(citySlug);
    const rows = await this.prisma.ad.findMany({
      where: {
        cityId,
        status: 'APPROVED',
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

  async businesses(citySlug: string, limit: number = DEFAULT_CONTENT_LIMIT): Promise<BusinessItem[]> {
    const cityId = await this.resolveCity(citySlug);
    return this.prisma.business.findMany({
      where: { cityId, status: 'APPROVED' },
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

    const businesses = await this.prisma.business.findMany({
      where: { cityId: city.id, status: 'APPROVED', latitude: { not: null }, longitude: { not: null } },
      orderBy: [{ showcasePriority: 'asc' }, { rating: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        subscriptionTier: true,
        category: { select: { name: true, slug: true, icon: true, color: true } },
      },
    });

    return {
      city,
      businesses: businesses.map((b) => ({
        ...b,
        latitude: b.latitude as number,
        longitude: b.longitude as number,
      })),
    };
  }

  /** A single published news article + view counting (Phase 6). */
  async newsDetail(slug: string): Promise<NewsDetail> {
    const item = await this.prisma.news.findFirst({
      where: { slug, status: 'PUBLISHED' },
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
        ownerId: true,
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
      },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const updated = await this.prisma.business.update({
      where: { id: business.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    return { ...business, viewCount: updated.viewCount };
  }
}
