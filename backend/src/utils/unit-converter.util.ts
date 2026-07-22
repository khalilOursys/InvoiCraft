// src/utils/unit-converter.util.ts

import { Injectable } from '@nestjs/common';
import { UnitService } from '../unit/unit.service';

@Injectable()
export class UnitConverter {
  constructor(private unitService: UnitService) {}

  /**
   * Convert a value from one unit to another using DB data
   */
  async convert(
    value: number,
    fromUnitId: number,
    toUnitId: number,
  ): Promise<number> {
    if (fromUnitId === toUnitId) {
      return value;
    }

    const fromUnit = await this.unitService.getUnitById(fromUnitId);
    const toUnit = await this.unitService.getUnitById(toUnitId);

    if (fromUnit.family !== toUnit.family) {
      throw new Error(
        `Cannot convert from ${fromUnit.code} (${fromUnit.family}) to ${toUnit.code} (${toUnit.family})`,
      );
    }

    const fromBaseUnit = fromUnit.baseUnitId
      ? await this.unitService.getUnitById(fromUnit.baseUnitId)
      : fromUnit;

    const toBaseUnit = toUnit.baseUnitId
      ? await this.unitService.getUnitById(toUnit.baseUnitId)
      : toUnit;

    if (fromBaseUnit.id !== toBaseUnit.id) {
      throw new Error(
        `Incompatible base units: ${fromBaseUnit.code} vs ${toBaseUnit.code}`,
      );
    }

    const valueInBase = value * fromUnit.conversionToBase;
    const result = valueInBase / toUnit.conversionToBase;

    return result;
  }

  async areUnitsCompatible(unitId1: number, unitId2: number): Promise<boolean> {
    if (unitId1 === unitId2) return true;

    const unit1 = await this.unitService.getUnitById(unitId1);
    const unit2 = await this.unitService.getUnitById(unitId2);

    return unit1.family === unit2.family;
  }

  async getBaseUnit(unitId: number): Promise<any> {
    const unit = await this.unitService.getUnitById(unitId);

    if (unit.baseUnitId) {
      return this.unitService.getUnitById(unit.baseUnitId);
    }

    return unit;
  }

  async hasSubUnits(unitId: number): Promise<boolean> {
    const subUnits = await this.unitService.getSubUnitsForUnit(unitId);
    return subUnits.length > 0;
  }

  async getCompatibleUnits(unitId: number): Promise<any[]> {
    const unit = await this.unitService.getUnitById(unitId);
    return this.unitService.getUnitsByFamily(unit.family);
  }

  async format(
    value: number,
    unitId: number,
    decimals: number = 2,
  ): Promise<string> {
    const unit = await this.unitService.getUnitById(unitId);
    return `${value.toFixed(decimals)} ${unit.symbol}`;
  }

  async getConversionFactor(
    fromUnitId: number,
    toUnitId: number,
  ): Promise<number> {
    if (fromUnitId === toUnitId) {
      return 1;
    }

    const fromUnit = await this.unitService.getUnitById(fromUnitId);
    const toUnit = await this.unitService.getUnitById(toUnitId);

    if (fromUnit.family !== toUnit.family) {
      throw new Error(
        `Cannot get conversion factor between different families`,
      );
    }

    return fromUnit.conversionToBase / toUnit.conversionToBase;
  }

  async batchConvert(
    values: number[],
    fromUnitId: number,
    toUnitId: number,
  ): Promise<number[]> {
    const factor = await this.getConversionFactor(fromUnitId, toUnitId);
    return values.map((v) => v * factor);
  }
}
