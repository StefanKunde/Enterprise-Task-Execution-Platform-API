import {
  IsBoolean,
  IsNumber,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class StickerSettingsDto {
  @IsBoolean()
  'buy-items-with-stickers': boolean;

  @IsNumber()
  'max-price-for-item-with-stickers': number;

  @IsNumber()
  'max-variance-for-item-with-stickers': number;

  @IsNumber()
  'total-sticker-values-percentage-by-item-value': number;

  @IsNumber()
  'minimum-total-sticker-value': number;
}

class CasesFilterDto {
  @IsBoolean()
  'buy-cases': boolean;

  @IsNumber()
  'min-val': number;

  @IsNumber()
  'max-val': number;
}

class ProFilterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  'conditions-to-not-buy'?: string[];
}

class ItemFilterDto {
  @IsArray()
  @IsString({ each: true })
  namesToIgnore: string[];

  @IsArray()
  @IsString({ each: true })
  typesToIgnore: string[];

  @ValidateNested()
  @Type(() => StickerSettingsDto)
  stickerSettings: StickerSettingsDto;

  @IsBoolean()
  buyKnifesWithStattrak: boolean;

  @ValidateNested()
  @Type(() => CasesFilterDto)
  'cases-filter': CasesFilterDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProFilterDto)
  'name-type-condition-filters-not-buy': ProFilterDto[];
}

export class UpdateFilterDto {
  @IsNumber()
  max_value_threshold: number;

  @IsNumber()
  min_value_threshold: number;

  @IsNumber()
  max_variance: number;

  @ValidateNested()
  @Type(() => ItemFilterDto)
  'item-filter': ItemFilterDto;
}
