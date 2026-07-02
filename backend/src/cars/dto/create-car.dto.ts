import { IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateCarDto {
  @IsString()
  @IsNotEmpty()
  registration: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsInt()
  @IsOptional()
  year?: number;
}
