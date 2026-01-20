import { IsString, IsNumber } from 'class-validator';

export class BalanceUpdateDto {
  @IsString()
  sessionId: string;

  @IsString()
  platformUserId: string;

  @IsNumber()
  balance: number;

  @IsString()
  reason: string;

  @IsNumber()
  timestamp: number;
}
