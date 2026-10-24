import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** One authenticated user's rating and optional text for a business. */
export class SaveBusinessReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}
