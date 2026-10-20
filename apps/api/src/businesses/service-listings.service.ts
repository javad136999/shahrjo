import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceListingDto } from './service-listings.dto';

@Injectable()
export class ServiceListingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public directory search: only lightweight listings, never Business profiles. */
  async list(citySlug: string, limit = 200, categorySlug?: string) {
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
      where: { cityId: city.id, isActive: true, ...(categoryId === undefined ? {} : { categoryId }) },
      take: Math.max(1, Math.min(200, limit)),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        description: true,
        category: { select: { name: true, slug: true, icon: true } },
      },
    });
  }

  /** Register a free service listing. This deliberately never creates a Business. */
  async create(user: User, dto: CreateServiceListingDto) {
    const city = await this.prisma.city.findFirst({
      where: { slug: dto.citySlug, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true, isService: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('این دسته‌بندی در فهرست خدمات شهر نیست');

    return this.prisma.serviceListing.create({
      data: {
        ownerId: user.id,
        cityId: city.id,
        categoryId: category.id,
        name: dto.name,
        phone: dto.phone,
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
  }
}
