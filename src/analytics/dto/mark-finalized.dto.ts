import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

export class MarkSoldDto {
  @IsNumber()
  sellPrice: number;

  @IsDateString()
  sellDate: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
