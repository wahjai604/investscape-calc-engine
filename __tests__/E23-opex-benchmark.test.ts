/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateOpExBenchmark } from "../src/E23-opex-benchmark";
import { OpExBenchmarkInput, OpExPropertyType } from "../src/types";

function baseInput(overrides: Partial<OpExBenchmarkInput> = {}): OpExBenchmarkInput {
  return {
    propertyType: "sfh",
    grossAnnualRent: 40000,
    country: "Canada",
    locationTier: "suburban",
    includePropertyManagement: false,
    ...overrides,
  };
}

describe("calculateOpExBenchmark — base rate by property type (suburban, no management)", () => {
  const cases: Array<[OpExPropertyType, number]> = [
    ["sfh", 0.275],
    ["duplex", 0.275],
    ["triplex", 0.275],
    ["fourplex", 0.275],
    ["multifamily_5_20", 0.325],
    ["multifamily_20plus", 0.375],
    ["commercial", 0.4],
    ["mixed_use", 0.45],
  ];

  it.each(cases)("%s uses its range midpoint (%d) as the base rate at suburban tier", (propertyType, expectedRate) => {
    const result = calculateOpExBenchmark(baseInput({ propertyType, locationTier: "suburban" }));

    expect(result.opexPercentOfGrossRent).toBeCloseTo(expectedRate, 6);
  });
});

describe("calculateOpExBenchmark — location tier adjustment (flat percentage-point, not multiplicative)", () => {
  it("urban adds a flat 5 percentage points to the base rate", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "urban" }));

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.325, 6);
  });

  it("suburban applies no adjustment to the base rate", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "suburban" }));

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.275, 6);
  });

  it("rural subtracts a flat 5 percentage points from the base rate", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "rural" }));

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.225, 6);
  });

  it("matches the spec's own worked example: SFH urban + 8% management = 27.5% + 5% + 8% = 40.5%", () => {
    const result = calculateOpExBenchmark(
      baseInput({ propertyType: "sfh", locationTier: "urban", includePropertyManagement: true, propertyManagementPercent: 0.08 })
    );

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.405, 6);
  });

  it("matches the spec's own worked example: Commercial retail urban = 40% + 5% = 45%", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "commercial", locationTier: "urban" }));

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.45, 6);
  });
});

describe("calculateOpExBenchmark — property management fee", () => {
  it("adds the management percent on top of base + tier when the flag is true and a rate is given", () => {
    const result = calculateOpExBenchmark(
      baseInput({ propertyType: "multifamily_5_20", locationTier: "suburban", includePropertyManagement: true, propertyManagementPercent: 0.1 })
    );

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.325 + 0.1, 6);
    expect(result.opexBreakdown.propertyManagement_percent).toBeCloseTo(0.1, 6);
  });

  it("adds 0 management when the flag is true but no rate is provided (no default assumed)", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "suburban", includePropertyManagement: true }));

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.275, 6);
    expect(result.opexBreakdown.propertyManagement_percent).toBe(0);
  });

  it("ignores a supplied management percent when the flag is false", () => {
    const result = calculateOpExBenchmark(
      baseInput({ propertyType: "sfh", locationTier: "suburban", includePropertyManagement: false, propertyManagementPercent: 0.1 })
    );

    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.275, 6);
    expect(result.opexBreakdown.propertyManagement_percent).toBe(0);
  });
});

describe("calculateOpExBenchmark — dollar amounts", () => {
  it("estimatedAnnualOpEx is grossAnnualRent × opexPercentOfGrossRent", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "urban", grossAnnualRent: 60000 }));

    expect(result.estimatedAnnualOpEx).toBeCloseTo(60000 * 0.325, 2);
  });

  it("a grossAnnualRent of $0 produces $0 estimated annual OpEx, while the percentage stays meaningful", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "commercial", locationTier: "urban", grossAnnualRent: 0 }));

    expect(result.estimatedAnnualOpEx).toBe(0);
    expect(result.opexPercentOfGrossRent).toBeCloseTo(0.45, 6);
  });
});

describe("calculateOpExBenchmark — category breakdown", () => {
  it("vacancy_percent is always 0 — the E26 spec excludes vacancy from these benchmark rates", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "mixed_use", locationTier: "urban", includePropertyManagement: true, propertyManagementPercent: 0.12 }));

    expect(result.opexBreakdown.vacancy_percent).toBe(0);
  });

  it("propertyTax, insurance, maintenance, and utilities shares sum with management to the total opex percent", () => {
    const result = calculateOpExBenchmark(
      baseInput({ propertyType: "multifamily_20plus", locationTier: "rural", includePropertyManagement: true, propertyManagementPercent: 0.06 })
    );
    const { propertyTax_percent, insurance_percent, maintenance_repair_percent, utilities_percent, vacancy_percent, propertyManagement_percent } =
      result.opexBreakdown;

    const sum = propertyTax_percent + insurance_percent + maintenance_repair_percent + utilities_percent + vacancy_percent + propertyManagement_percent;
    expect(sum).toBeCloseTo(result.opexPercentOfGrossRent, 6);
  });

  it("the urban/rural tier adjustment is split evenly between property tax and maintenance", () => {
    const suburban = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "suburban" }));
    const urban = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "urban" }));

    expect(urban.opexBreakdown.propertyTax_percent - suburban.opexBreakdown.propertyTax_percent).toBeCloseTo(0.025, 6);
    expect(urban.opexBreakdown.maintenance_repair_percent - suburban.opexBreakdown.maintenance_repair_percent).toBeCloseTo(0.025, 6);
    expect(urban.opexBreakdown.insurance_percent).toBeCloseTo(suburban.opexBreakdown.insurance_percent, 6);
    expect(urban.opexBreakdown.utilities_percent).toBeCloseTo(suburban.opexBreakdown.utilities_percent, 6);
  });
});

describe("calculateOpExBenchmark — country has no effect on the calculation", () => {
  it("Canada and US produce identical results for the same property type/tier", () => {
    const ca = calculateOpExBenchmark(baseInput({ propertyType: "commercial", locationTier: "urban", country: "Canada" }));
    const us = calculateOpExBenchmark(baseInput({ propertyType: "commercial", locationTier: "urban", country: "US" }));

    expect(us.opexPercentOfGrossRent).toBeCloseTo(ca.opexPercentOfGrossRent, 6);
    expect(us.opexBreakdown).toEqual(ca.opexBreakdown);
  });
});

describe("calculateOpExBenchmark — summary, disclaimer, and result structure", () => {
  it("summary reports the property type's range, dollar amount, and effective percentage consistently with the typed fields", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "sfh", locationTier: "urban", grossAnnualRent: 40000 }));

    expect(result.summary).toBe(
      `SFH typical OpEx: 25-30% of gross rent. This deal: $${result.estimatedAnnualOpEx.toFixed(2)}/year (${(result.opexPercentOfGrossRent * 100).toFixed(1)}% of gross rent).`
    );
  });

  it("disclaimer is the fixed OpEx variability notice", () => {
    const result = calculateOpExBenchmark(baseInput());

    expect(result.disclaimer).toBe("OpEx varies by property condition, age, location. Consult contractor estimates.");
  });

  it("propertyType on the result echoes the input propertyType", () => {
    const result = calculateOpExBenchmark(baseInput({ propertyType: "multifamily_5_20" }));

    expect(result.propertyType).toBe("multifamily_5_20");
  });

  it("returns every field defined on OpExBenchmarkResult", () => {
    const result = calculateOpExBenchmark(baseInput());

    expect(result).toEqual(
      expect.objectContaining({
        propertyType: expect.any(String),
        opexPercentOfGrossRent: expect.any(Number),
        estimatedAnnualOpEx: expect.any(Number),
        opexBreakdown: expect.any(Object),
        summary: expect.any(String),
        disclaimer: expect.any(String),
      })
    );
  });
});
