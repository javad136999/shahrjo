import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export enum BusinessListingKindDto {
  PROPERTY = 'PROPERTY',
  VEHICLE = 'VEHICLE',
}

export enum PropertyDealTypeDto {
  SALE = 'SALE',
  RENT = 'RENT',
  MORTGAGE_RENT = 'MORTGAGE_RENT',
}

export class CreateBusinessListingDto {
  @IsEnum(BusinessListingKindDto)
  kind!: BusinessListingKindDto;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsEnum(PropertyDealTypeDto)
  dealType?: PropertyDealTypeDto;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) deposit?: number;
  @IsOptional() @IsInt() @Min(0) monthlyRent?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100000) areaM2?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) rooms?: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) year?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000000) mileage?: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(40) color?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(40) transmission?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(40) fuel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];

  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class UpdateBusinessListingDto extends CreateBusinessListingDto {}
