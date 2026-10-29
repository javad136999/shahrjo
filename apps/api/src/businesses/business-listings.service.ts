import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessListingKind, Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessListingDto, UpdateBusinessListingDto } from './business-listings.dto';

const listingSelect = {
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
} satisfies Prisma.BusinessListingSelect;

type ListingRow = Prisma.BusinessListingGetPayload<{ select: typeof listingSelect }>;

function asNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

function view(row: ListingRow) {
  return {
    ...row,
    kind: String(row.kind),
    price: asNumber(row.price),
    deposit: asNumber(row.deposit),
    monthlyRent: asNumber(row.monthlyRent),
    imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls.filter((item): item is string => typeof item === 'string') : [],
  };
}

@Injectable()
export class BusinessListingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedBusiness(user: User, businessId: number) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: user.id, status: { not: 'DELETED' } },
      select: { id: true, category: { select: { slug: true } } },
    });
    if (!business) throw new NotFoundException('کسب‌وکار یافت نشد');
    return business;
  }

  private assertKind(categorySlug: string, kind: string) {
    const isProperty = categorySlug === 'real_estate';
    const isVehicle = categorySlug === 'car_dealer';
    if ((kind === 'PROPERTY' && !isProperty) || (kind === 'VEHICLE' && !isVehicle)) {
      throw new BadRequestException('این داشبورد برای دسته‌بندی کسب‌وکار انتخاب‌شده قابل استفاده نیست');
    }
  }

  async mine(user: User, businessId: number) {
    const business = await this.ownedBusiness(user, businessId);
    const rows = await this.prisma.businessListing.findMany({
      where: { businessId },
      orderBy: [{ isAvailable: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: listingSelect,
    });
    return { kind: business.category.slug === 'real_estate' ? 'PROPERTY' : 'VEHICLE', listings: rows.map(view) };
  }

  async create(user: User, businessId: number, dto: CreateBusinessListingDto) {
    const business = await this.ownedBusiness(user, businessId);
    this.assertKind(business.category.slug, dto.kind);
    const row = await this.prisma.businessListing.create({
      data: {
        businessId,
        kind: dto.kind as BusinessListingKind,
        title: dto.title,
        dealType: dto.dealType,
        description: dto.description,
        price: dto.price === undefined ? undefined : BigInt(dto.price),
        deposit: dto.deposit === undefined ? undefined : BigInt(dto.deposit),
        monthlyRent: dto.monthlyRent === undefined ? undefined : BigInt(dto.monthlyRent),
        areaM2: dto.areaM2,
        rooms: dto.rooms,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        mileage: dto.mileage,
        color: dto.color,
        transmission: dto.transmission,
        fuel: dto.fuel,
        imageUrls: dto.imageUrls ?? [],
        isAvailable: dto.isAvailable ?? true,
      },
      select: listingSelect,
    });
    return view(row);
  }

  async update(user: User, businessId: number, listingId: number, dto: UpdateBusinessListingDto) {
    const business = await this.ownedBusiness(user, businessId);
    this.assertKind(business.category.slug, dto.kind);
    const existing = await this.prisma.businessListing.findFirst({ where: { id: listingId, businessId }, select: { id: true } });
    if (!existing) throw new NotFoundException('فایل یافت نشد');
    const row = await this.prisma.businessListing.update({
      where: { id: listingId },
      data: {
        kind: dto.kind as BusinessListingKind,
        title: dto.title,
        dealType: dto.dealType,
        description: dto.description,
        price: dto.price === undefined ? undefined : BigInt(dto.price),
        deposit: dto.deposit === undefined ? undefined : BigInt(dto.deposit),
        monthlyRent: dto.monthlyRent === undefined ? undefined : BigInt(dto.monthlyRent),
        areaM2: dto.areaM2,
        rooms: dto.rooms,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        mileage: dto.mileage,
        color: dto.color,
        transmission: dto.transmission,
        fuel: dto.fuel,
        imageUrls: dto.imageUrls ?? [],
        isAvailable: dto.isAvailable ?? true,
      },
      select: listingSelect,
    });
    return view(row);
  }

  async remove(user: User, businessId: number, listingId: number) {
    await this.ownedBusiness(user, businessId);
    const existing = await this.prisma.businessListing.findFirst({ where: { id: listingId, businessId }, select: { id: true } });
    if (!existing) throw new NotFoundException('فایل یافت نشد');
    await this.prisma.businessListing.delete({ where: { id: listingId } });
    return { id: listingId, deleted: true };
  }
}
