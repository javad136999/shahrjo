import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** Body for POST /payments/checkout (creates a pending Cafe Bazaar purchase). */
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

/** Purchase data returned by Poolakey after the Bazaar dialog succeeds. */
export class BazaarVerifyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentId!: number;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  purchaseToken!: string;
}
