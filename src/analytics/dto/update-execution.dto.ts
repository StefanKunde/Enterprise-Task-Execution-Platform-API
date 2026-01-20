import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateExecutionDto {
  @IsOptional()
  @IsNumber()
  manualOutboundValue?: number;

  @IsOptional()
  @IsDateString()
  manualOutboundDate?: string;

  @IsOptional()
  @IsString()
  userNotes?: string;
}
