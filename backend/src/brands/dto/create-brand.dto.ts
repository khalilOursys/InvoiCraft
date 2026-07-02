import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional() // Allow variantId to be optional
  description?: string;

  @IsOptional() // Allow variantId to be optional
  img?: string;
}
