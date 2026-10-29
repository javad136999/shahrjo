import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceListingDto } from './service-listings.dto';

const normalizePhone = (value: string) => value
  .normalize('NFKC')
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/\D/g, '');

@Injectable()
export class ServiceListingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Count every active service entry in the city without paging/truncation. */
  async count(citySlug: string) {
    const city = await this.prisma.city.findFirst({
      where: { slug: citySlug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');
    return this.prisma.serviceListing.count({ where: { cityId: city.id, isActive: true } });
  }

  /** Active listing count for each service category in the city, including zeroes. */
  async categoryCounts(citySlug: string) {
    const city = await this.prisma.city.findFirst({
      where: { slug: citySlug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');
    const [categories, grouped] = await Promise.all([
      this.prisma.businessCategory.findMany({
        where: { isService: true, isActive: true },
        select: { id: true, slug: true },
      }),
      this.prisma.serviceListing.groupBy({
        by: ['categoryId'],
        where: { cityId: city.id, isActive: true },
        _count: { _all: true },
      }),
    ]);
    const countByCategoryId = new Map(grouped.map((row) => [row.categoryId, row._count._all]));
    return Object.fromEntries(categories.map((category) => [category.slug, countByCategoryId.get(category.id) ?? 0]));
  }

  /** Public directory search: only lightweight listings, never Business profiles. */
  async list(citySlug: string, limit = 200, categorySlug?: string, query?: string) {
    const city = await this.prisma.city.findFirst({
      where: { slug: citySlug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    let categoryId: number | undefined;
    if (categorySlug) {
      const category = await this.prisma.businessCategory.findFirst({
        where: { slug: categorySlug, isActive: true, isService: true },
        select: { id: true },
      });
      if (!category) throw new NotFoundException('این دسته‌بندی در فهرست خدمات شهر نیست');
      categoryId = category.id;
    }

    return this.prisma.serviceListing.findMany({
      where: { cityId: city.id, isActive: true, ...(categoryId === undefined ? {} : { categoryId }), ...(query?.trim() ? { name: { contains: query.trim(), mode: 'insensitive' as const } } : {}) },
      take: Math.max(1, Math.min(200, limit)),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        description: true,
        category: { select: { name: true, slug: true, icon: true } },
        ratings: { select: { rating: true } },
      },
    }).then((rows) => {
      const nowBucket = Math.floor(Date.now() / 60_000);
      const requestSalt = Math.floor(Math.random() * 0x7fffffff);
      const rated = rows.map((row) => {
        const total = row.ratings.reduce((sum, item) => sum + item.rating, 0);
        const ratingCount = row.ratings.length;
        const rating = ratingCount ? total / ratingCount : 0;
        const { ratings: _ratings, ...listing } = row;
        return { ...listing, rating: Number(rating.toFixed(2)), ratingCount };
      });
      // Popularity is the primary sort; entries with the same aggregate rating
      // rotate in a minute-wide, city/category-specific cohort for equitable exposure.
      const seed = `${city.id}:${categoryId ?? query ?? 'all'}:${nowBucket}:${requestSalt}`;
      const offset = [...seed].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7) % Math.max(1, rated.length);
      return rated.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount || ((a.id - rated[offset].id + rated.length) % rated.length) - ((b.id - rated[offset].id + rated.length) % rated.length));
    });
  }

  async rate(user: User, listingId: number, rating: number) {
    const listing = await this.prisma.serviceListing.findFirst({ where: { id: listingId, isActive: true }, select: { id: true, ownerId: true } });
    if (!listing) throw new NotFoundException('شغل مورد نظر پیدا نشد');
    if (listing.ownerId === user.id) throw new ForbiddenException('امتیازدهی به شغل خودت امکان‌پذیر نیست');
    await this.prisma.serviceListingRating.upsert({
      where: { serviceListingId_userId: { serviceListingId: listingId, userId: user.id } },
      create: { serviceListingId: listingId, userId: user.id, rating },
      update: { rating },
    });
    const aggregate = await this.prisma.serviceListingRating.aggregate({ where: { serviceListingId: listingId }, _avg: { rating: true }, _count: { _all: true } });
    return { rating: aggregate._avg.rating ?? 0, ratingCount: aggregate._count._all, userRating: rating };
  }

  /** Register a free service listing. This deliberately never creates a Business. */
  async create(user: User, dto: CreateServiceListingDto) {
    const city = await this.prisma.city.findFirst({
      where: { slug: dto.citySlug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    const normalizedPhone = normalizePhone(dto.phone);
    if (normalizedPhone.length < 4 || normalizedPhone.length > 15) throw new BadRequestException('شماره تماس معتبر وارد کن');
    const existingPhone = await this.prisma.serviceListing.findFirst({ where: { normalizedPhone }, select: { id: true } });
    if (existingPhone) throw new ConflictException('این شماره تماس قبلاً برای ثبت شغل استفاده شده است');

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true, isService: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('این دسته‌بندی در فهرست خدمات شهر نیست');

    try {
      return await this.prisma.serviceListing.create({
      data: {
        ownerId: user.id,
        cityId: city.id,
        categoryId: category.id,
        name: dto.name,
        phone: normalizedPhone,
        normalizedPhone,
        uniquePhoneGuard: true,
        description: dto.description ?? null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        description: true,
        category: { select: { name: true, slug: true, icon: true } },
      },
    });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('این شماره تماس قبلاً برای ثبت شغل استفاده شده است');
      }
      throw error;
    }
  }
}
