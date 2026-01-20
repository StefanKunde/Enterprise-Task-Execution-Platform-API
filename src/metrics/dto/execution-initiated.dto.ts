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

class ExecutionItemDto {
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

export class ExecutionInitialDto {
  @IsString()
  sessionId: string;

  @IsString()
  platformUserId: string;

  @IsString()
  executionId: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  transactionType?: string;

  @IsString()
  initiatedAt: string;

  @IsNumber()
  totalValue: number;

  @IsNumber()
  marginPercent: number;

  @IsOptional()
  @IsNumber()
  delayMs: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecutionItemDto)
  items: ExecutionItemDto[];

  @IsNumber()
  timestamp: number;
}
