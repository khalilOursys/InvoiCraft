// dto/update-status.dto.ts

import { IsEnum, IsNotEmpty } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(InvoiceStatus)
  @IsNotEmpty()
  status: InvoiceStatus;
}
