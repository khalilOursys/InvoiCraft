// src/unit/unit.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Controller('units')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  async getAllUnits() {
    return this.unitService.getAllUnits();
  }

  @Get('families')
  async getUnitFamilies() {
    return this.unitService.getUnitFamilies();
  }

  @Get('family/:family')
  async getUnitsByFamily(@Param('family') family: string) {
    return this.unitService.getUnitsByFamily(family);
  }

  @Get(':id')
  async getUnitById(@Param('id', ParseIntPipe) id: number) {
    return this.unitService.getUnitById(id);
  }

  @Get('code/:code')
  async getUnitByCode(@Param('code') code: string) {
    return this.unitService.getUnitByCode(code);
  }

  @Get(':id/base')
  async getBaseUnit(@Param('id', ParseIntPipe) id: number) {
    return this.unitService.getBaseUnitForUnit(id);
  }

  @Get(':id/subunits')
  async getSubUnits(@Param('id', ParseIntPipe) id: number) {
    return this.unitService.getSubUnitsForUnit(id);
  }

  @Post()
  async createUnit(@Body() data: CreateUnitDto) {
    return this.unitService.createUnit(data);
  }

  @Put(':id')
  async updateUnit(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateUnitDto,
  ) {
    return this.unitService.updateUnit(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUnit(@Param('id', ParseIntPipe) id: number) {
    return this.unitService.deleteUnit(id);
  }

  @Post('seed')
  async seedDefaultUnits() {
    await this.unitService.seedDefaultUnits();
    return { message: 'Default units seeded successfully' };
  }
}
