import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBusinessDto,
  CreateProductDto,
  CreateQuickBusinessDto,
  UpdateBusinessDto,
  UpdateProductDto,
} from './businesses.dto';

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

/** One row of the owner's business list («کسب‌وکارهای من»). */
export interface MyBusiness {
  id: number;
  name: string;
  slug: string;
  status: string;
  subscriptionTier: string;
  /** ACTIVE / EXPIRED / NONE — a suspended row tells the owner why + how to reactivate. */
  subscriptionStatus: string;
  /** Paid-until timestamp (null for FREE registrations). */
  subscriptionExpiresAt: Date | null;
  logoUrl: string | null;
  rating: number;
  ratingCount: number;
  productCount: number;
  /** true when the business has coordinates (i.e. it shows on the city map). */
  pinned: boolean;
  category: { id: number; name: string; icon: string | null };
}

/** One menu/product row as the owner manages it. */
export interface ManagedProduct {
  id: number;
  name: string;
  description: string | null;
  /** Rial — null = «توافقی». */
  price: number | null;
  imageUrl: string | null;
  /** Free-text menu group («نوشیدنی»، «غذاهای اصلی»…) — null = بدون دسته. */
  section: string | null;
  sortOrder: number;
  isAvailable: boolean;
}

/** Full owner view: editable profile fields + the menu rows. */
export interface ManagedBusiness extends MyBusiness {
  description: string | null;
  phone: string | null;
  address: string | null;
  /** Coordinates of the pin shown on the city map (null = not pinned yet). */
  latitude: number | null;
  longitude: number | null;
  categoryId: number;
  products: ManagedProduct[];
}

/**
 * Public path prefix of our own uploads. A business photo must live here —
 * a foreign/hot-linked URL is rejected (it would let an owner point the site
 * at somebody else's server, and it would never be scanned by the sweep).
 */
const INTERNAL_FILE_PREFIX = '/api/v1/files/';

/** Trimmed string; empty string means «پاک کن» (stored as NULL). */
function clean(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** BigInt Rial -> Number on the wire (amounts fit safely). */
function rial(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

type CityGeo = { latitude: number | null; longitude: number | null; boundary: unknown };

/** Shared with the admin manual signup — the pin must be in the chosen city. */
export type BusinessCityGeo = CityGeo;

/** Bounding box of a stored boundary (GeoJSON object or the seed's raw rings). */
function boundaryBox(raw: unknown): { minLat: number; minLng: number; maxLat: number; maxLng: number } | null {
  const points: number[][] = [];
  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      points.push([node[1], node[0]]); // stored as [lng, lat]
      return;
    }
    for (const child of node) visit(child);
  };
  if (Array.isArray(raw)) visit(raw);
  else if (raw && typeof raw === 'object') visit((raw as { coordinates?: unknown }).coordinates);
  if (points.length === 0) return null;
  const lats = points.map((pt) => pt[0]);
  const lngs = points.map((pt) => pt[1]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/**
 * Rough containment for owner-picked pins: inside the admin boundary
 * (bbox + ~5 km margin) or within ~0.35° of the city centre. Cities with no
 * geo data accept any pin — there is nothing to compare against.
 * Exported: the admin's manual signup validates its pin the same way.
 */
export function assertInCity(city: CityGeo, lat: number, lng: number): void {
  const bbox = boundaryBox(city.boundary);
  if (bbox) {
    const margin = 0.05;
    if (
      lat >= bbox.minLat - margin &&
      lat <= bbox.maxLat + margin &&
      lng >= bbox.minLng - margin &&
      lng <= bbox.maxLng + margin
    ) {
      return;
    }
  }
  if (city.latitude !== null && city.longitude !== null) {
    if (Math.abs(lat - city.latitude) <= 0.35 && Math.abs(lng - city.longitude) <= 0.35) return;
  }
  if (!bbox && city.latitude === null) return;
  throw new BadRequestException('موقعیت انتخاب‌شده خارج از محدوده این شهر است؛ دوباره روی نقشه انتخاب کنید');
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

  /**
   * Active *service* trades (تعمیرکار کولر، نقاش ساختمان، کابینت‌ساز…) — the
   * list the city-home service desk offers. The general signup keeps every
   * category, so shops and venues stay out of here.
   */
  async serviceCategories(): Promise<BusinessCategoryOption[]> {
    return this.prisma.businessCategory.findMany({
      where: { isActive: true, isService: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, icon: true },
    });
  }

  async create(user: User, dto: CreateBusinessDto): Promise<CreatedBusiness> {
    if (!user.cityId) throw new BadRequestException('ابتدا شهر خودت را انتخاب کن');

    // The photo must be the caller's own upload — validated first, so a
    // rejected image cannot leave a half-configured business behind.
    const logoUrl = clean(dto.logoUrl) ?? null;
    if (logoUrl) await this.assertOwnedImage(user, logoUrl);

    const city = await this.prisma.city.findFirst({
      where: { id: user.cityId, isActive: true, province: { isActive: true } },
      select: { id: true, latitude: true, longitude: true, boundary: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    // The pin must actually belong to this city — a map framed on another
    // city used to save coordinates 100+ km away (cross-city data corruption).
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      assertInCity(city, dto.latitude, dto.longitude);
    }

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');

    const slug = await this.uniqueSlug(dto.name);

    const created = await this.prisma.business.create({
      data: {
        ownerId: user.id,
        cityId: city.id,
        categoryId: category.id,
        name: dto.name,
        slug,
        logoUrl,
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

    if (logoUrl) await this.claimImage(user, logoUrl, created.id);

    return { ...created, status: String(created.status), subscriptionTier: String(created.subscriptionTier) };
  }

  /**
   * The city-home service desk («شغلتو ثبت کن»): a compact, free signup for a
   * service trade that publishes immediately — neighbours must be able to find
   * and call the tradesperson the same minute they registered.
   *
   * Deliberate difference from `create`: no payment, no admin step, so the
   * abuse surface is trimmed elsewhere instead — only `isService` categories
   * are accepted, the contact phone is mandatory (it is the point of the
   * listing), and the slug is still unique. The
   * requested active city slug is validated server-side so the new row appears
   * in the same city's service search. An operator can suspend or delete any
   * row from the admin queue.
   */
  async createQuick(user: User, dto: CreateQuickBusinessDto): Promise<CreatedBusiness> {
    const city = await this.prisma.city.findFirst({
      where: dto.citySlug
        ? { slug: dto.citySlug, isActive: true, province: { isActive: true } }
        : { id: user.cityId ?? -1, isActive: true, province: { isActive: true } },
      select: { id: true },
    });
    if (!city) throw new NotFoundException('شهر انتخاب‌شده یافت نشد');

    const category = await this.prisma.businessCategory.findFirst({
      where: { id: dto.categoryId, isActive: true, isService: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('این دسته‌بندی در فهرست خدمات شهر نیست');

    const slug = await this.uniqueSlug(dto.name);

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
        // Service desk: published immediately (see the doc comment above).
        status: 'APPROVED',
        subscriptionTier: 'FREE',
        subscriptionStatus: 'NONE',
      },
      select: { id: true, name: true, slug: true, status: true, subscriptionTier: true },
    });

    return { ...created, status: String(created.status), subscriptionTier: String(created.subscriptionTier) };
  }

  /** Unique slug: base + short random suffix, verified against the table. */
  private async uniqueSlug(name: string): Promise<string> {
    const base = businessSlug(name);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
      const clash = await this.prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!clash) return candidate;
    }
    throw new HttpException('خطا در ثبت کسب‌وکار؛ دوباره تلاش کنید', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * The caller's own businesses — the «کسب‌وکارهای من» list. Deleted rows are
   * gone for good (an admin delete is final); suspended ones (manual or after
   * the subscription ran out) stay visible so the owner can reactivate them
   * by buying a plan.
   */
  async mine(user: User): Promise<MyBusiness[]> {
    const rows = await this.prisma.business.findMany({
      where: { ownerId: user.id, status: { not: 'DELETED' } },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        logoUrl: true,
        rating: true,
        ratingCount: true,
        latitude: true,
        category: { select: { id: true, name: true, icon: true } },
        _count: { select: { products: true } },
      },
    });
    return rows.map(({ _count, latitude, ...rest }) => ({
      ...rest,
      status: String(rest.status),
      subscriptionTier: String(rest.subscriptionTier),
      subscriptionStatus: String(rest.subscriptionStatus),
      productCount: _count.products,
      pinned: latitude !== null,
    }));
  }

  /**
   * One of the caller's own businesses with its menu rows. Scoped by
   * `ownerId` in the WHERE clause (never by trusting the id alone): a
   * stranger's business is a 404, not a 403 that would leak its existence.
   */
  async manage(user: User, id: number): Promise<ManagedBusiness> {
    const business = await this.prisma.business.findFirst({
      where: { id, ownerId: user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        logoUrl: true,
        rating: true,
        ratingCount: true,
        latitude: true,
        longitude: true,
        description: true,
        phone: true,
        address: true,
        categoryId: true,
        category: { select: { id: true, name: true, icon: true } },
        products: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            section: true,
            sortOrder: true,
            isAvailable: true,
          },
        },
      },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const { products, latitude, ...rest } = business;
    return {
      ...rest,
      latitude,
      status: String(rest.status),
      subscriptionTier: String(rest.subscriptionTier),
      subscriptionStatus: String(rest.subscriptionStatus),
      pinned: latitude !== null,
      productCount: products.length,
      products: products.map((product) => ({ ...product, price: rial(product.price) })),
    };
  }

  /**
   * Owner edit of the public profile fields. Status/tier/city stay under
   * platform control: an approved business keeps its approval, an edited one
   * is never silently re-queued (the admin panel owns moderation).
   */
  async update(user: User, id: number, dto: UpdateBusinessDto): Promise<ManagedBusiness> {
    await this.assertOwned(user, id);

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.businessCategory.findFirst({
        where: { id: dto.categoryId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new NotFoundException('دسته‌بندی یافت نشد');
    }

    const current = await this.prisma.business.findFirst({
      where: { id, ownerId: user.id },
      select: { logoUrl: true },
    });
    if (!current) throw new NotFoundException('کسب‌وکار یافت نشد');

    const data: Record<string, string | number | null> = {};
    const name = clean(dto.name);
    if (name !== undefined) {
      if (name === null) throw new BadRequestException('نام کسب‌وکار الزامی است');
      data.name = name;
    }
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    for (const field of ['description', 'phone', 'address'] as const) {
      const value = clean(dto[field]);
      if (value !== undefined) data[field] = value;
    }

    const logo = clean(dto.logoUrl);
    if (logo !== undefined) {
      if (logo) await this.assertOwnedImage(user, logo);
      data.logoUrl = logo;
    }

    await this.prisma.business.update({ where: { id }, data });

    // The replaced/cleared picture is released: soft-deleted, so the storage
    // sweep frees its bytes instead of keeping a photo nobody points at.
    if (logo !== undefined && current.logoUrl && current.logoUrl !== logo) {
      await this.releaseImageIfUnused(user, current.logoUrl);
    }
    if (logo) await this.claimImage(user, logo, id);

    return this.manage(user, id);
  }

  /** Add one menu/product row to an owned business. */
  async addProduct(user: User, id: number, dto: CreateProductDto): Promise<ManagedProduct> {
    await this.assertOwned(user, id);

    const imageUrl = clean(dto.imageUrl) ?? null;
    if (imageUrl) await this.assertOwnedImage(user, imageUrl);

    const created = await this.prisma.businessProduct.create({
      data: {
        businessId: id,
        name: dto.name.trim(),
        description: clean(dto.description) ?? null,
        price: dto.price === undefined ? null : BigInt(dto.price),
        imageUrl,
        section: clean(dto.section) ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isAvailable: dto.isAvailable ?? true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        section: true,
        sortOrder: true,
        isAvailable: true,
      },
    });
    if (imageUrl) await this.claimImage(user, imageUrl, id);
    return { ...created, price: rial(created.price) };
  }

  /** Edit one menu/product row (name, group, price, photo, availability). */
  async updateProduct(
    user: User,
    id: number,
    productId: number,
    dto: UpdateProductDto,
  ): Promise<ManagedProduct> {
    await this.assertOwned(user, id);
    await this.assertOwnedProduct(id, productId);

    const before = await this.prisma.businessProduct.findFirst({
      where: { id: productId, businessId: id },
      select: { imageUrl: true },
    });

    const data: Record<string, string | number | bigint | boolean | null> = {};
    const name = clean(dto.name);
    if (name !== undefined) {
      if (name === null) throw new BadRequestException('نام محصول الزامی است');
      data.name = name;
    }
    for (const field of ['description', 'section'] as const) {
      const value = clean(dto[field]);
      if (value !== undefined) data[field] = value;
    }

    const imageUrl = clean(dto.imageUrl);
    if (imageUrl !== undefined) {
      if (imageUrl) await this.assertOwnedImage(user, imageUrl);
      data.imageUrl = imageUrl;
    }

    if (dto.price !== undefined) data.price = BigInt(dto.price);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;

    if (imageUrl) await this.claimImage(user, imageUrl, id);
    if (imageUrl !== undefined && before?.imageUrl && before.imageUrl !== imageUrl) {
      await this.releaseImageIfUnused(user, before.imageUrl, productId);
    }

    const updated = await this.prisma.businessProduct.update({
      where: { id: productId },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        section: true,
        sortOrder: true,
        isAvailable: true,
      },
    });
    return { ...updated, price: rial(updated.price) };
  }

  /** Remove one menu/product row (cascades with the business). */
  async removeProduct(user: User, id: number, productId: number): Promise<{ id: number; removed: true }> {
    await this.assertOwned(user, id);
    await this.assertOwnedProduct(id, productId);

    const product = await this.prisma.businessProduct.findFirst({
      where: { id: productId, businessId: id },
      select: { imageUrl: true },
    });
    await this.prisma.businessProduct.delete({ where: { id: productId } });

    // The row is gone — its picture must not keep occupying the disk (unless
    // another one of the owner's rows/logo still points at the same file).
    if (product?.imageUrl) await this.releaseImageIfUnused(user, product.imageUrl);
    return { id: productId, removed: true };
  }

  /** Ownership gate — scoped by ownerId, so foreign ids look like 404. */
  private async assertOwned(user: User, id: number): Promise<void> {
    const owned = await this.prisma.business.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('کسب‌وکار یافت نشد');
  }

  /**
   * A business photo must be a stored upload of the caller: same-origin
   * `/api/v1/files/...` path that belongs to one of their own Media rows.
   * Foreign URLs are refused (no hot-linking, no unaccounted bytes).
   */
  private async assertOwnedImage(user: User, url: string): Promise<void> {
    if (!url.startsWith(INTERNAL_FILE_PREFIX)) {
      throw new BadRequestException('فقط عکس‌های آپلودشده در سایت قابل انتخاب هستند');
    }
    const media = await this.prisma.media.findFirst({
      where: { url, ownerUserId: user.id },
      select: { id: true },
    });
    if (!media) throw new BadRequestException('این عکس پیدا نشد؛ دوباره آپلود کنید');
  }

  /**
   * Marks the Media row as attached to this business (`entityType: BUSINESS`,
   * `entityId: <id>`) — the orphan sweep only deletes *unclaimed* uploads, so
   * claiming is what keeps an owner's real photos alive.
   */
  private async claimImage(user: User, url: string, businessId: number): Promise<void> {
    await this.prisma.media.updateMany({
      where: { url, ownerUserId: user.id },
      data: { entityType: 'BUSINESS', entityId: String(businessId) },
    });
  }

  /**
   * Frees the bytes of a picture no row points at any more: soft-deleted, so
   * the storage sweep hard-deletes the file after its retention window.
   * Skipped while another product/logo of the same owner still uses the URL.
   */
  private async releaseImageIfUnused(user: User, url: string, exceptProductId?: number): Promise<void> {
    const [usedByProducts, usedAsLogo] = await Promise.all([
      this.prisma.businessProduct.count({
        where: {
          imageUrl: url,
          business: { ownerId: user.id },
          ...(exceptProductId ? { id: { not: exceptProductId } } : {}),
        },
      }),
      this.prisma.business.count({ where: { ownerId: user.id, logoUrl: url } }),
    ]);
    if (usedByProducts > 0 || usedAsLogo > 0) return;

    await this.prisma.media.updateMany({
      where: { url, ownerUserId: user.id, deletedAt: null },
      data: { deletedAt: new Date(), entityId: null },
    });
  }

  /** The product must belong to that business (no cross-business edits). */
  private async assertOwnedProduct(businessId: number, productId: number): Promise<void> {
    const product = await this.prisma.businessProduct.findFirst({
      where: { id: productId, businessId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('محصول یافت نشد');
  }
}
