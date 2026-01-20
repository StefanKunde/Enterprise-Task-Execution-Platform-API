import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetMaintenanceDto {
  @IsBoolean()
  maintenance: boolean;

  @IsOptional()
  @IsString()
  message?: string | null;
}
