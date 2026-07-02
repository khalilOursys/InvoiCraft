import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHeroBannerDto {
  @IsOptional() // Allow variantId to be optional
  name?: string;

  @IsOptional() // Allow variantId to be optional
  description?: string;

  @IsOptional() // Allow variantId to be optional
  img?: string;
}
