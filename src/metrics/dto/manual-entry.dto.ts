import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';

export class ManualPurchaseDto {
  @IsString()
  executionId: string;

  @IsEnum(['system', 'manual'])
  purchaseSource: 'system' | 'manual';

  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
