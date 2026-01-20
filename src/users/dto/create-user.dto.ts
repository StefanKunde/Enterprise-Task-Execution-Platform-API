import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsMongoId,
  IsObject,
  IsNumber,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsEmail({}, { message: 'Ungültige E-Mail-Adresse' })
  email?: string | null;

  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;

  @IsString()
  @IsOptional()
  emailVerificationToken?: string | null;

  @IsString()
  @IsOptional()
  emailVerificationExpires?: Date | null;

  @IsString()
  @IsOptional()
  password?: string | null;

  @IsString()
  @IsOptional()
  platformId?: string | null;

  @IsString()
  @IsOptional()
  platformAvatar?: string | null;

  @IsString()
  @IsOptional()
  platformDisplayName?: string | null;

  @IsString()
  @IsOptional()
  platformProfileUrl?: string | null;

  @IsString()
  @IsOptional()
  lastUsedCookies?: string;

  @IsBoolean()
  @IsOptional()
  isCurrentlyUsingSystem?: boolean;

  @IsMongoId()
  @IsOptional()
  proxy?: string; // reference to Proxy document

  @IsObject()
  @IsOptional()
  filterJson?: any;

  @IsBoolean()
  @IsOptional()
  isMasterUser?: boolean;

  @IsBoolean()
  @IsOptional()
  isSuperUser?: boolean;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsNumber()
  @IsOptional()
  lastKnownBalance?: number;
}
