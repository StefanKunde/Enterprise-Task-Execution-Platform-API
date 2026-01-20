import { IsString } from 'class-validator';

export class MatchExecutionsDto {
  @IsString()
  purchaseExecutionId: string;
}
