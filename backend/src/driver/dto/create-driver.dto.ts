import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MinLength,
  IsPhoneNumber,
  IsEmail,
  IsNumber,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  /* @IsPhoneNumber() */
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  cin?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  carId?: number;
}
