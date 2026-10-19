import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * Business registration submitted by the owner. The city always comes from the
 * caller's selected profile city (multi-city rule — no client-side city ids),
 * mirroring ad submission. Location is optional so the owner can pin it on the
 * map later; status always starts as PENDING for admin review.
 */
export class CreateBusinessDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsInt()
  @Min(1)
  categoryId!: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  /**
   * Photo of the business, as returned by `POST /uploads/business`. Must be
   * the caller's own upload — the API refuses foreign URLs.
   */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

/**
 * Compact service-desk signup («شغلتو ثبت کن» on the city home page).
 *
 * Deliberately narrower than {@link CreateBusinessDto}: no photo, no map pin
 * and no plan — the whole point is a tradesperson getting listed in under a
 * minute. `phone` is required (not optional) because calling is how the listing
 * is used, and `categoryId` must be a service trade: the API refuses anything
 * outside the service-desk list.
 */
export class CreateQuickBusinessDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  citySlug?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsInt()
  @Min(1)
  categoryId!: number;

  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(15)
  phone!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

/**
 * Owner edit of an already-registered business. Only the public profile
 * fields are editable here; status, tier and city stay under platform control
 * (moderation + payments own them). An empty string clears the field.
 */
export class UpdateBusinessDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  /** Business photo (own upload) — empty string clears it. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}

/**
 * One menu/product row. `section` is the free-text menu group the owner writes
 * («نوشیدنی»، «غذاهای اصلی»…) so the public menu renders grouped without a
 * second table; an empty section means «بدون دسته».
 */
export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Rial. Omitted/null = «توافقی». */
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

/** Partial edit of one product — every field optional. */
export class UpdateProductDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
