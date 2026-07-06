// src/utils/unit-converter.util.ts

export class UnitConverter {
  private static readonly conversionMap: Record<
    string,
    Record<string, number>
  > = {
    // Volume conversions (all lowercase keys)
    ml: { ml: 1, l: 0.001, cl: 0.1, dl: 0.01, m3: 0.000001 },
    l: { ml: 1000, l: 1, cl: 100, dl: 10, m3: 0.001 },
    cl: { ml: 10, l: 0.01, cl: 1, dl: 0.1, m3: 0.00001 },
    dl: { ml: 100, l: 0.1, cl: 10, dl: 1, m3: 0.0001 },
    m3: { ml: 1000000, l: 1000, cl: 100000, dl: 10000, m3: 1 },

    // Weight conversions (all lowercase keys)
    g: { g: 1, kg: 0.001, mg: 1000, lb: 0.00220462, oz: 0.035274 },
    kg: { g: 1000, kg: 1, mg: 1000000, lb: 2.20462, oz: 35.274 },
    mg: { g: 0.001, kg: 0.000001, mg: 1, lb: 0.00000220462, oz: 0.000035274 },
    lb: { g: 453.592, kg: 0.453592, mg: 453592, lb: 1, oz: 16 },
    oz: { g: 28.3495, kg: 0.0283495, mg: 28349.5, lb: 0.0625, oz: 1 },
  };

  static convert(value: number, fromUnit: string, toUnit: string): number {
    // Check if units are provided
    if (!fromUnit || !toUnit) {
      throw new Error('Both fromUnit and toUnit are required');
    }

    // Convert to lowercase and trim
    const fromUnitLower = fromUnit.toLowerCase().trim();
    const toUnitLower = toUnit.toLowerCase().trim();

    // If same unit, return the same value
    if (fromUnitLower === toUnitLower) {
      return value;
    }

    // Check if units exist in the map
    if (!this.conversionMap[fromUnitLower]) {
      throw new Error(
        `Unknown unit: ${fromUnit} (supported: ${Object.keys(this.conversionMap).join(', ')})`,
      );
    }

    if (!this.conversionMap[toUnitLower]) {
      throw new Error(
        `Unknown unit: ${toUnit} (supported: ${Object.keys(this.conversionMap).join(', ')})`,
      );
    }

    // Check if conversion exists
    const conversion = this.conversionMap[fromUnitLower]?.[toUnitLower];

    if (conversion === undefined) {
      throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
    }

    return value * conversion;
  }

  static areUnitsCompatible(unit1: string, unit2: string): boolean {
    const volumeUnits = ['ml', 'l', 'cl', 'dl', 'm3'];
    const weightUnits = ['g', 'kg', 'mg', 'lb', 'oz'];

    const unit1Lower = unit1.toLowerCase().trim();
    const unit2Lower = unit2.toLowerCase().trim();

    // Check if both are volume units
    const isUnit1Volume = volumeUnits.includes(unit1Lower);
    const isUnit2Volume = volumeUnits.includes(unit2Lower);

    // Check if both are weight units
    const isUnit1Weight = weightUnits.includes(unit1Lower);
    const isUnit2Weight = weightUnits.includes(unit2Lower);

    // Units are compatible if both are volume or both are weight
    return (isUnit1Volume && isUnit2Volume) || (isUnit1Weight && isUnit2Weight);
  }
}
