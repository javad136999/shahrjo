import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class RedeemReferralCreditDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  businessId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;
}
