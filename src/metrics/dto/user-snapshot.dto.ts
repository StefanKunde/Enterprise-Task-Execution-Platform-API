import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ExchangeRatesDto {
  @IsNumber()
  EUR: number;

  @IsNumber()
  USD: number;
}

export class UserDataDto {
  @IsString()
  sessionId: string;

  @IsString()
  userId: string;

  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  email: string | null;

  @IsString()
  platformId: string;

  @IsNumber()
  level: number;

  @IsNumber()
  xp: number;

  @IsNumber()
  balance: number;

  @IsBoolean()
  flaggedUser: boolean;

  @IsOptional()
  @IsString()
  restrictedUntil: string | null;

  @IsOptional()
  @IsString()
  bannedUntil: string | null;

  @IsNumber()
  weeklyLimit: number;

  @IsNumber()
  remainingInstantPayoutAmount: number;

  @ValidateNested()
  @Type(() => ExchangeRatesDto)
  exchangeRates: ExchangeRatesDto;

  @IsNumber()
  collectedAt: number;
}
