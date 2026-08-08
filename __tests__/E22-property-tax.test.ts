/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculatePropertyTax } from "../src/E22-property-tax";
import { PropertyTaxInput } from "../src/types";

function baseCanadaInput(overrides: Partial<PropertyTaxInput> = {}): PropertyTaxInput {
  return {
    propertyValue: 1000000,
    country: "Canada",
    province: "BC",
    state: "",
    propertyType: "residential",
    isNewConstruction: false,
    ...overrides,
  };
}

function baseUSInput(overrides: Partial<PropertyTaxInput> = {}): PropertyTaxInput {
  return {
    propertyValue: 1000000,
    country: "US",
    province: "",
    state: "CA",
    propertyType: "residential",
    isNewConstruction: false,
    ...overrides,
  };
}

describe("calculatePropertyTax — Canadian jurisdictions", () => {
  it("BC residential uses the 0.85% recognized provincial rate", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "BC", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0085, 6);
    expect(result.estimatedAnnualTax).toBeCloseTo(8500, 2);
    expect(result.jurisdiction).toBe("BC");
    expect(result.taxRateSource).toBe("provincial_average");
  });

  it("BC commercial uses the 1.35% recognized provincial rate", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "BC", propertyType: "commercial" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0135, 6);
    expect(result.estimatedAnnualTax).toBeCloseTo(13500, 2);
    expect(result.taxRateSource).toBe("provincial_average");
  });

  it("ON residential uses the 0.65% recognized provincial rate", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "ON", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0065, 6);
    expect(result.jurisdiction).toBe("ON");
    expect(result.taxRateSource).toBe("provincial_average");
  });

  it("AB residential uses the 0.55% recognized provincial rate", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "AB", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0055, 6);
    expect(result.jurisdiction).toBe("AB");
  });

  it("province codes are matched case-insensitively", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "bc", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0085, 6);
    expect(result.jurisdiction).toBe("BC");
    expect(result.taxRateSource).toBe("provincial_average");
  });

  it("an unrecognized province falls back to the Canada default rate and 'estimated' source", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "QC", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.007, 6);
    expect(result.taxRateSource).toBe("estimated");
    expect(result.jurisdiction).toBe("QC");
  });

  it("an unrecognized province preserves the caller's original casing in jurisdiction", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "Quebec", propertyType: "commercial" }));

    expect(result.jurisdiction).toBe("Quebec");
    expect(result.effectiveTaxRate).toBeCloseTo(0.01, 6);
  });

  it("industrial property type falls back to the jurisdiction's commercial rate", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "ON", propertyType: "industrial" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.011, 6);
  });

  it("land property type falls back to the jurisdiction's commercial rate", () => {
    const result = calculatePropertyTax(baseCanadaInput({ province: "AB", propertyType: "land" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.009, 6);
  });
});

describe("calculatePropertyTax — US jurisdictions", () => {
  it("CA residential uses the 0.76% recognized state rate", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "CA", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0076, 6);
    expect(result.jurisdiction).toBe("California");
    expect(result.taxRateSource).toBe("county_average");
  });

  it("TX commercial uses the 1.00% recognized state rate", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "TX", propertyType: "commercial" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.01, 6);
    expect(result.jurisdiction).toBe("Texas");
  });

  it("AZ residential uses the 0.65% recognized state rate", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "AZ", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0065, 6);
    expect(result.jurisdiction).toBe("Arizona");
  });

  it("NY residential uses the 1.75% recognized state rate", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "NY", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0175, 6);
    expect(result.jurisdiction).toBe("New York");
  });

  it("FL commercial uses the 1.00% recognized state rate", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "FL", propertyType: "commercial" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.01, 6);
    expect(result.jurisdiction).toBe("Florida");
  });

  it("state codes are matched case-insensitively", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "ca", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.0076, 6);
    expect(result.jurisdiction).toBe("California");
  });

  it("an unrecognized state falls back to the US default rate and 'estimated' source", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "WA", propertyType: "residential" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.009, 6);
    expect(result.taxRateSource).toBe("estimated");
    expect(result.jurisdiction).toBe("WA");
  });

  it("an unrecognized state uses the US default commercial rate for non-residential types", () => {
    const result = calculatePropertyTax(baseUSInput({ state: "WA", propertyType: "commercial" }));

    expect(result.effectiveTaxRate).toBeCloseTo(0.011, 6);
    expect(result.taxRateSource).toBe("estimated");
  });
});

describe("calculatePropertyTax — derived amounts", () => {
  it("estimatedAnnualTax is propertyValue × effectiveTaxRate", () => {
    const result = calculatePropertyTax(baseUSInput({ propertyValue: 750000, state: "NY", propertyType: "residential" }));

    expect(result.estimatedAnnualTax).toBeCloseTo(750000 * 0.0175, 2);
  });

  it("taxPerMonth is estimatedAnnualTax / 12", () => {
    const result = calculatePropertyTax(baseCanadaInput({ propertyValue: 600000, province: "BC", propertyType: "residential" }));

    expect(result.taxPerMonth).toBeCloseTo(result.estimatedAnnualTax / 12, 6);
  });

  it("a property value of $0 produces $0 annual tax and $0 monthly tax", () => {
    const result = calculatePropertyTax(baseCanadaInput({ propertyValue: 0, province: "BC" }));

    expect(result.estimatedAnnualTax).toBe(0);
    expect(result.taxPerMonth).toBe(0);
  });

  it("propertyValue on the result echoes the input value unchanged", () => {
    const result = calculatePropertyTax(baseUSInput({ propertyValue: 425000 }));

    expect(result.propertyValue).toBe(425000);
  });
});

describe("calculatePropertyTax — disclaimer and summary", () => {
  it("disclaimer omits the new-construction note when isNewConstruction is false", () => {
    const result = calculatePropertyTax(baseCanadaInput({ isNewConstruction: false }));

    expect(result.disclaimer).toBe("Tax rates vary by county/municipality. Consult local assessor.");
  });

  it("disclaimer appends the new-construction note when isNewConstruction is true", () => {
    const result = calculatePropertyTax(baseCanadaInput({ isNewConstruction: true }));

    expect(result.disclaimer.startsWith("Tax rates vary by county/municipality. Consult local assessor.")).toBe(true);
    expect(result.disclaimer).toContain("new construction");
  });

  it("summary reports annual tax, monthly tax, rate, and jurisdiction consistently with the typed fields", () => {
    const result = calculatePropertyTax(baseUSInput({ propertyValue: 500000, state: "TX", propertyType: "commercial" }));

    expect(result.summary).toBe(
      `Property tax estimated at $${result.estimatedAnnualTax.toFixed(2)}/year ($${result.taxPerMonth.toFixed(2)}/month) based on a ${(result.effectiveTaxRate * 100).toFixed(2)}% rate in ${result.jurisdiction}.`
    );
  });
});

describe("calculatePropertyTax — result structure", () => {
  it("returns every field defined on PropertyTaxResult", () => {
    const result = calculatePropertyTax(baseCanadaInput());

    expect(result).toEqual(
      expect.objectContaining({
        propertyValue: expect.any(Number),
        effectiveTaxRate: expect.any(Number),
        estimatedAnnualTax: expect.any(Number),
        taxPerMonth: expect.any(Number),
        jurisdiction: expect.any(String),
        taxRateSource: expect.any(String),
        disclaimer: expect.any(String),
        summary: expect.any(String),
      })
    );
  });

  it("a very high property value ($50M) still scales linearly with no tiering", () => {
    const result = calculatePropertyTax(baseUSInput({ propertyValue: 50000000, state: "NY", propertyType: "residential" }));

    expect(result.estimatedAnnualTax).toBeCloseTo(50000000 * 0.0175, 2);
  });
});
