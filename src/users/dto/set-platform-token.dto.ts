import { IsString, Length } from 'class-validator';

export class SetPlatformWebTokenDto {
  @IsString()
  @Length(10, 1000)
  token: string;
}
