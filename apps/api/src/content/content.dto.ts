import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Shared query for /news, /ads and /businesses: a city slug + optional page size. */
export class CityContentQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Optional title-text query for city service listings. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  /** Optional ad-category slug — only ads of that category are returned. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_000_000_000_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_000_000_000_000_000)
  maxPrice?: number;
}
