import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** POST /dm/conversations — open (or create) a private conversation with a peer. */
export class StartDmDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;
}

/** GET /dm/conversations/:id/messages — cursor pagination (newest page first). */
export class DmMessagesQueryDto {
  /** Cursor: return messages created strictly before this ISO timestamp. */
  @IsOptional()
  @IsISO8601()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** POST /dm/conversations/:id/messages — a text body and/or one image. */
export class SendDmDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body?: string;

  /** Media id from POST /uploads, owned by the sender. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  imageId?: number;
}
