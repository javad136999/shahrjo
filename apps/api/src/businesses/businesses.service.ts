import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './businesses.dto';

/** Per-user cap on newly registered businesses per day (anti-flood). */
const MAX_NEW_PER_DAY = 5;

export interface BusinessCategoryOption {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

export interface CreatedBusiness {
  id: number;
  name: string;
  slug: string;
  status: string;
  subscriptionTier: string;
}

/** URL-safe slug; Persian names keep their letters/numbers, plus a random suffix for uniqueness. */
function businessSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'business';
}

/**
 * Owner-submitted business registration. Every new business enters the
 * moderation queue as PENDING with a FREE tier — the paid tier is applied only
 * after a verified payment (and, for business-bound plans, admin approval).
 * The city always comes from the caller's validated profile selection.
 */
@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active business categories for the registration form (public). */
  async categories(): Promise<BusinessCategoryOption[]> {
    return this.prisma.businessCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, icon: true },
    });
  }

  async create(user: User, dto: CreateBusinessDto): Promise<CreatedBusiness> {
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
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');

    const dayAgo = new Date(Date.now() - 86_400_000);
    const recent = await this.prisma.business.count({
      where: { ownerId: user.id, createdAt: { gte: dayAgo } },
    });
    if (recent >= MAX_NEW_PER_DAY) {
      throw new HttpException(
        'سقف ثبت کسب‌وکار در روز پر شده است؛ فردا دوباره تلاش کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Unique slug: base + short random suffix, verified against the table.
    const base = businessSlug(dto.name);
    let slug = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
      const clash = await this.prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!clash) {
        slug = candidate;
        break;
      }
    }
    if (!slug) throw new HttpException('خطا در ثبت کسب‌وکار؛ دوباره تلاش کنید', HttpStatus.INTERNAL_SERVER_ERROR);

    const created = await this.prisma.business.create({
      data: {
        ownerId: user.id,
        cityId: city.id,
        categoryId: category.id,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        phone: dto.phone ?? user.phone ?? null,
        address: dto.address ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        status: 'PENDING', // moderation queue — never APPROVED from user input
        subscriptionTier: 'FREE', // paid tier only after a verified payment
        subscriptionStatus: 'NONE',
      },
      select: { id: true, name: true, slug: true, status: true, subscriptionTier: true },
    });

    return { ...created, status: String(created.status), subscriptionTier: String(created.subscriptionTier) };
  }
}
