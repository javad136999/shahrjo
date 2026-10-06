import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** GET /wall — city feed pagination. */
export class WallListQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** Cursor: return posts created strictly before this ISO timestamp. */
  @IsOptional()
  @IsISO8601()
  before?: string;
}

/** POST /wall — publish a post (optionally replying + one image). */
export class CreateWallPostDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cityId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  replyToId?: number;

  /** Media ids from POST /uploads (at most one image per post). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  imageIds?: number[];
}

/** POST /wall/:id/pin — operators pin at most one post per city. */
export class PinWallPostDto {
  @IsOptional()
  pinned?: boolean;
}
