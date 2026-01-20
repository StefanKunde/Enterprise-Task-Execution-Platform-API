import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class StickerDto {
  @IsString()
  name: string;

  @IsString()
  imageUrl: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  wear?: number;
}

class HistoricalExecutionItemDto {
  @IsString()
  itemName: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StickerDto)
  stickers?: StickerDto[];
}

class HistoricalExecutionDto {
  @IsString()
  id: string;

  @IsString()
  status: string;

  @IsString()
  transactionType: string;

  @IsString()
  initiatedAt: string;

  @IsString()
  updatedAt: string;

  @IsNumber()
  totalValue: number;

  @IsNumber()
  marginPercent: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricalExecutionItemDto)
  executionItems: HistoricalExecutionItemDto[];

  // Optional flattened items array (preferred for imageUrl support)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricalExecutionItemDto)
  items?: HistoricalExecutionItemDto[];
}

export class ExecutionHistoryDto {
  @IsString()
  sessionId: string;

  @IsString()
  platformUserId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricalExecutionDto)
  executions: HistoricalExecutionDto[];

  @IsNumber()
  timestamp: number;
}
