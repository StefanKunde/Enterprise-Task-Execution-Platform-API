import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExecutorCookie {
  @IsString() name!: string;
  @IsString() value!: string;
  @IsString() domain!: string;
  @IsString() path!: string;
  @IsOptional() @IsString() expires?: string;
  @IsOptional() @IsString() sameSite?: string;
  @IsOptional() @IsString() secure?: string;
  @IsOptional() @IsString() httpOnly?: string;
}

export class ExecutorConfigDto {
  @IsString() sessionId!: string;
  @IsArray() filterItems!: string[];
  @IsNumber() maxThreshold!: number;
  @IsNumber() minThreshold!: number;
  @IsNumber() maxVariance!: number;
  @IsOptional() @IsBoolean() filterByCategory?: boolean;
}

export class StartExecutorDto {
  // The executor parameters
  @ValidateNested()
  @Type(() => ExecutorConfigDto)
  executor!: ExecutorConfigDto;
}
