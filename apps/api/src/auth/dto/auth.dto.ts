import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class SendOtpDto {
  // Loose syntactic check here; strict Iranian-mobile validation happens in AuthService.
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'کد ورود باید عددی باشد' })
  code!: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  // First-run city selection: must be an existing active city (checked in service).
  @IsOptional()
  @IsInt()
  @Min(1)
  cityId?: number;
}
