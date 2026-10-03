import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * Body for POST /ads (Phase 5 — user ad submission).
 * City is intentionally NOT accepted here: the ad always belongs to the
 * authenticated user's selected city (multi-city rule, no client-side ids).
 */
export class CreateAdDto {
  @IsInt()
  @Min(1)
  categoryId!: number;

  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  // Rial. Optional = «توافقی». Capped well inside safe Number/BigInt range.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_000_000_000_000_000)
  price?: number;

  @IsOptional()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  // Media ids returned by POST /uploads — ownership is re-checked in the service.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  imageIds?: number[];
}
