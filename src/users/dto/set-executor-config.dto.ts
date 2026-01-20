import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SetExecutorConfigDto {
  @IsString() sessionId!: string;
  @IsArray() filterItems!: string[];
  @IsNumber() maxThreshold!: number;
  @IsNumber() minThreshold!: number;
  @IsNumber() maxVariance!: number;
  @IsOptional() @IsBoolean() filterByCategory?: boolean;
}
