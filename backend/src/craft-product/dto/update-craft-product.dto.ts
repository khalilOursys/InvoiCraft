import { PartialType } from '@nestjs/mapped-types';
import { CreateCraftProductDto } from './create-craft-product.dto';

export class UpdateCraftProductDto extends PartialType(CreateCraftProductDto) {
  totalCost?: number;
  salePrice?: number;
}
