import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** A lightweight service-directory entry, not a Business profile. */
export class CreateServiceListingDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  citySlug!: string;

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
  @MaxLength(500)
  description?: string;
}

export class RateServiceListingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}
