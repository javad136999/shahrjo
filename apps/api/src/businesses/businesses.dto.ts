import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** Optional social handles/links stored as JSON on the business row. */
export class SocialLinksDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  instagram?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegram?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

/**
 * Body for POST /businesses (business registration). Like POST /ads, the city
 * is intentionally NOT accepted: the business always belongs to the
 * authenticated user's selected city, so a client cannot file it elsewhere.
 */
export class CreateBusinessDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  categoryId!: number;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  // Falls back to the account's own phone in the service when omitted.
  @IsOptional()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  // Map pin — both values or neither (enforced in the service).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  // Media ids returned by POST /uploads?entity=business — ownership re-checked.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  logoMediaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coverMediaId?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;
}
