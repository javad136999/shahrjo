import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBusinessDto,
  CreateProductDto,
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
  category: { id: number; name: string; slug?: string; icon: string | null };
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

export interface ManagedListing {
  id: number;
  businessId: number;
  kind: string;
  title: string;
  dealType: string | null;
  description: string | null;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  areaM2: number | null;
  rooms: number | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  color: string | null;
  transmission: string | null;
  fuel: string | null;
  specifications: unknown;
  imageUrls: string[];
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
  listings: ManagedListing[];
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

type PolygonRings = number[][][];

/** Normalize GeoJSON and the raw Polygon/MultiPolygon arrays used by the seed. */
function boundaryPolygons(raw: unknown): number[][][][] | null {
  let candidate = raw;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const object = candidate as { type?: unknown; geometry?: unknown; coordinates?: unknown };
    if (object.type === 'Feature') candidate = object.geometry;
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const geometry = candidate as { type?: unknown; coordinates?: unknown };
      if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates as PolygonRings];
      }
      if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates as number[][][][];
      }
      candidate = geometry.coordinates;
    }
  }
  if (!Array.isArray(candidate) || candidate.length === 0) return null;
  const first = candidate[0] as unknown[] | undefined;
  const second = first?.[0] as unknown[] | undefined;
  const third = second?.[0];
  if (typeof third === 'number') return [candidate as PolygonRings];
  const fourth = Array.isArray(third) ? third[0] : undefined;
  if (typeof fourth === 'number') return candidate as number[][][][];
  return null;
}

function pointInRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const [x1, y1] = a;
    const [x2, y2] = b;
    const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-10 && lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2) && lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2)) {
      return true;
    }
    if ((y1 > lat) !== (y2 > lat) && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function pointInBoundary(polygons: number[][][][], lng: number, lat: number): boolean {
  return polygons.some((rings) => {
    const [outer, ...holes] = rings;
    return Boolean(outer && pointInRing(outer, lng, lat) && !holes.some((hole) => pointInRing(hole, lng, lat)));
  });
}

/**
 * A pin must be a finite WGS84 point inside the configured city polygon. When
 * only a centre exists, keep it within a town-scale ±0.15° window. Cities with
 * no geographic data cannot safely accept a pinned business.
 * Exported so moderation, registration and the public map share one rule.
 */
export function isCoordinateInCity(city: CityGeo, lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  const polygons = boundaryPolygons(city.boundary);
  if (polygons) {
    if (pointInBoundary(polygons, lng, lat)) return true;
    // If the outline is imperfect, allow only a small centre-area fallback.
    return city.latitude !== null && city.longitude !== null &&
      Math.abs(lat - city.latitude) <= 0.05 && Math.abs(lng - city.longitude) <= 0.05;
  }
  if (city.latitude !== null && city.longitude !== null) {
    return Math.abs(lat - city.latitude) <= 0.15 && Math.abs(lng - city.longitude) <= 0.15;
  }
  return false;
}

export function assertInCity(city: CityGeo, lat: number, lng: number): void {
  if (isCoordinateInCity(city, lat, lng)) return;
  if (boundaryPolygons(city.boundary) || (city.latitude !== null && city.longitude !== null)) {
    throw new BadRequestException('موقعیت انتخاب‌شده خارج از محدوده این شهر است؛ روی محدوده شهر دوباره انتخاب کنید');
  }
  throw new BadRequestException('محدوده جغرافیایی این شهر تنظیم نشده است؛ فعلاً موقعیت را ثبت نکنید');
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

    // Coordinates are optional, but a half-pin is never meaningful and used
    // to leave rows that could not be consistently shown on the map.
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude) throw new BadRequestException('مختصات باید کامل وارد شود');
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
        category: { select: { id: true, name: true, slug: true, icon: true } },
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
        category: { select: { id: true, name: true, slug: true, icon: true } },
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
        listings: {
          orderBy: [{ isAvailable: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            businessId: true,
            kind: true,
            title: true,
            dealType: true,
            description: true,
            price: true,
            deposit: true,
            monthlyRent: true,
            areaM2: true,
            rooms: true,
            brand: true,
            model: true,
            year: true,
            mileage: true,
            color: true,
            transmission: true,
            fuel: true,
            specifications: true,
            imageUrls: true,
            sortOrder: true,
            isAvailable: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');

    const { products, listings, latitude, ...rest } = business;
    return {
      ...rest,
      latitude,
      status: String(rest.status),
      subscriptionTier: String(rest.subscriptionTier),
      subscriptionStatus: String(rest.subscriptionStatus),
      pinned: latitude !== null,
      productCount: products.length,
      products: products.map((product) => ({ ...product, price: rial(product.price) })),
      listings: (listings ?? []).map((listing) => ({
        ...listing,
        kind: String(listing.kind),
        price: rial(listing.price),
        deposit: rial(listing.deposit),
        monthlyRent: rial(listing.monthlyRent),
        imageUrls: Array.isArray(listing.imageUrls)
          ? listing.imageUrls.filter((item): item is string => typeof item === 'string')
          : [],
      })),
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
