import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Body for POST /payments/checkout (Phase 7 — ZarinPal subscription purchase). */
export class CheckoutDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  /** Optional: bind the subscription to one of the caller's businesses (ownership is re-checked). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  businessId?: number;
}
