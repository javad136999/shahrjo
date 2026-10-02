import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_CONTENT_LIMIT = 12;

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
  category: { name: string; slug: string };
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

/**
 * Read-only public feeds of a single city for the dashboard (Phase 4).
 * Every query is scoped by a resolved active city and by the public-facing
 * status only — drafts/pending/rejected content never leaves the API.
 */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

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
        category: { select: { name: true, slug: true } },
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
}
