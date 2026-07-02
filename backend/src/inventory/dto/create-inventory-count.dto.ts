import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryCountDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CountItemDto {
  @IsNotEmpty()
  @IsNumber()
  productId: number;

  @IsNotEmpty()
  @IsNumber()
  countedQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitInventoryCountDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountItemDto)
  items: CountItemDto[];
}
