// src/production-order/dto/update-production-order.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateProductionOrderDto } from './create-production-order.dto';

export class UpdateProductionOrderDto extends PartialType(
  CreateProductionOrderDto,
) {}
