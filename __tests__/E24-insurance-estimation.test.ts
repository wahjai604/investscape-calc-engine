import { calculateInsuranceEstimation } from "../src/E24-insurance-estimation";
import { InsuranceEstimationInput } from "../src/types";

function baseInput(overrides: Partial<InsuranceEstimationInput> = {}): InsuranceEstimationInput {
  return {
    propertyValue: 500000,
    propertyType: "sfh",
    country: "Canada",
    loanToValuePercent: 0.7,
    hasBeenInsured: true,
    buildingAgeYears: 10,
    ...overrides,
  };
}

describe("calculateInsuranceEstimation — Canada base rates (midpoint of the E27 spec range)", () => {
  it("SFH Canada uses the 0.5% midpoint (0.4-0.6%) before age adjustment", () => {
    // Age 10 falls in the "<20 years" bracket, which applies a 0% adjustment.
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "Canada", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.005, 6);
  });

  it("Duplex Canada uses the 0.6% midpoint (0.5-0.7%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "duplex", country: "Canada", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.006, 6);
  });

  it("Multifamily Canada uses the 0.75% midpoint (0.6-0.9%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "multifamily", country: "Canada", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.0075, 6);
  });

  it("Commercial Canada uses the 1.0% midpoint (0.8-1.2%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "commercial", country: "Canada", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.01, 6);
  });
});

describe("calculateInsuranceEstimation — US base rates (midpoint of the E27 spec range)", () => {
  it("SFH US uses the 0.65% midpoint (0.5-0.8%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "US", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.0065, 6);
  });

  it("Duplex US uses the 0.85% midpoint (0.7-1.0%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "duplex", country: "US", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.0085, 6);
  });

  it("Multifamily US uses the 1.1% midpoint (0.9-1.3%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "multifamily", country: "US", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.011, 6);
  });

  it("Commercial US uses the 1.4% midpoint (1.2-1.6%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "commercial", country: "US", buildingAgeYears: 10 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.014, 6);
  });
});

describe("calculateInsuranceEstimation — Canada building-age adjustment (multiplicative, Canada only)", () => {
  it("matches the spec's own worked example: 0.5% - 10% (age < 5) = 0.5% × 0.9 = 0.45%", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "Canada", buildingAgeYears: 3 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.0045, 6);
  });

  it("no adjustment for a building aged 5-19 years", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "Canada", buildingAgeYears: 15 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.005, 6);
  });

  it("matches the spec's own worked example: 0.5% + 30% (age >= 40) = 0.5% × 1.30 = 0.65%", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "Canada", buildingAgeYears: 45 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.0065, 6);
  });

  it("applies the +15% adjustment for a building aged 20-39 years", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "Canada", buildingAgeYears: 25 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.005 * 1.15, 6);
  });

  it("age-bracket boundary: exactly 20 years falls into the 20-39 (+15%) bracket, not the 5-19 (0%) bracket", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "sfh", country: "Canada", buildingAgeYears: 20 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.005 * 1.15, 6);
  });

  it("does NOT apply any age adjustment for US properties — matches the spec's Commercial USA control case (25yo, no adjustment, 1.4% flat)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "commercial", country: "US", buildingAgeYears: 25 }));

    expect(result.insuranceRatePercent).toBeCloseTo(0.014, 6);
  });
});

describe("calculateInsuranceEstimation — dollar amounts", () => {
  it("estimatedAnnualInsurance is propertyValue × insuranceRatePercent", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyValue: 800000, propertyType: "sfh", country: "Canada", buildingAgeYears: 10 }));

    expect(result.estimatedAnnualInsurance).toBeCloseTo(800000 * 0.005, 2);
  });

  it("estimatedMonthlyInsurance is estimatedAnnualInsurance / 12", () => {
    const result = calculateInsuranceEstimation(baseInput());

    expect(result.estimatedMonthlyInsurance).toBeCloseTo(result.estimatedAnnualInsurance / 12, 6);
  });

  it("a propertyValue of $0 produces $0 for every dollar amount", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyValue: 0, country: "US", loanToValuePercent: 0.95 }));

    expect(result.estimatedAnnualInsurance).toBe(0);
    expect(result.estimatedMonthlyInsurance).toBe(0);
    expect(result.totalAnnualInsurance).toBe(0);
  });
});

describe("calculateInsuranceEstimation — PMI (US only, LTV > 80%)", () => {
  it("Canada never requires PMI, regardless of LTV", () => {
    const result = calculateInsuranceEstimation(baseInput({ country: "Canada", loanToValuePercent: 0.97 }));

    expect(result.pmiRequired).toBe(false);
    expect(result.estimatedAnnualPMI).toBeNull();
    expect(result.insuranceBreakdown.pmi_percent).toBeNull();
  });

  it("US at exactly 80% LTV does not require PMI (threshold is strictly greater than 80%)", () => {
    const result = calculateInsuranceEstimation(baseInput({ country: "US", loanToValuePercent: 0.8 }));

    expect(result.pmiRequired).toBe(false);
    expect(result.estimatedAnnualPMI).toBeNull();
  });

  it("US just above 80% LTV requires PMI at the 0.55% floor rate", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyValue: 500000, country: "US", loanToValuePercent: 0.85 }));

    expect(result.pmiRequired).toBe(true);
    expect(result.insuranceBreakdown.pmi_percent).toBeCloseTo(0.0055, 6);
    expect(result.estimatedAnnualPMI).toBeCloseTo(500000 * 0.85 * 0.0055, 2);
  });

  it("US at 90% LTV uses the 0.8% PMI rate", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyValue: 500000, country: "US", loanToValuePercent: 0.9 }));

    expect(result.insuranceBreakdown.pmi_percent).toBeCloseTo(0.008, 6);
  });

  it("US at 95% LTV or higher uses the 1.2% PMI rate", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyValue: 500000, country: "US", loanToValuePercent: 0.95 }));

    expect(result.insuranceBreakdown.pmi_percent).toBeCloseTo(0.012, 6);
  });

  it("totalAnnualInsurance sums estimatedAnnualInsurance and estimatedAnnualPMI when PMI applies", () => {
    const result = calculateInsuranceEstimation(
      baseInput({ propertyValue: 400000, propertyType: "sfh", country: "US", buildingAgeYears: 10, loanToValuePercent: 0.95 })
    );

    expect(result.totalAnnualInsurance).toBeCloseTo(result.estimatedAnnualInsurance + (result.estimatedAnnualPMI ?? 0), 2);
  });

  it("totalAnnualInsurance equals estimatedAnnualInsurance alone when PMI does not apply", () => {
    const result = calculateInsuranceEstimation(baseInput({ country: "Canada" }));

    expect(result.totalAnnualInsurance).toBeCloseTo(result.estimatedAnnualInsurance, 6);
  });
});

describe("calculateInsuranceEstimation — dwelling/liability breakdown", () => {
  it("dwelling and liability shares sum to the full insuranceRatePercent (85%/15% split)", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyType: "multifamily", country: "US", buildingAgeYears: 30 }));

    const sum = result.insuranceBreakdown.dwelling_insurance_percent + result.insuranceBreakdown.liability_insurance_percent;
    expect(sum).toBeCloseTo(result.insuranceRatePercent, 6);
    expect(result.insuranceBreakdown.dwelling_insurance_percent).toBeCloseTo(result.insuranceRatePercent * 0.85, 6);
    expect(result.insuranceBreakdown.liability_insurance_percent).toBeCloseTo(result.insuranceRatePercent * 0.15, 6);
  });
});

describe("calculateInsuranceEstimation — unused input fields have no effect on the result", () => {
  it("state has no effect on the calculation (the E27 PMI table varies only by LTV)", () => {
    const withState = calculateInsuranceEstimation(baseInput({ country: "US", state: "TX" }));
    const withoutState = calculateInsuranceEstimation(baseInput({ country: "US", state: undefined }));

    expect(withState.insuranceRatePercent).toBeCloseTo(withoutState.insuranceRatePercent, 6);
  });

  it("hasBeenInsured has no effect on the calculation", () => {
    const insured = calculateInsuranceEstimation(baseInput({ hasBeenInsured: true }));
    const notInsured = calculateInsuranceEstimation(baseInput({ hasBeenInsured: false }));

    expect(insured.estimatedAnnualInsurance).toBeCloseTo(notInsured.estimatedAnnualInsurance, 6);
  });
});

describe("calculateInsuranceEstimation — summary, disclaimer, and result structure", () => {
  it("summary reports annual insurance, PMI, and total consistently with the typed fields", () => {
    const result = calculateInsuranceEstimation(baseInput({ country: "US", loanToValuePercent: 0.95, propertyValue: 400000 }));

    expect(result.summary).toBe(
      `Property insurance: $${result.estimatedAnnualInsurance.toFixed(2)}/year. PMI (if applicable): $${(result.estimatedAnnualPMI ?? 0).toFixed(2)}/year. Total: $${result.totalAnnualInsurance.toFixed(2)}/year.`
    );
  });

  it("disclaimer is the fixed insurance variability notice", () => {
    const result = calculateInsuranceEstimation(baseInput());

    expect(result.disclaimer).toBe("Insurance rates vary by property condition, claims history, and underwriting. This is an estimate.");
  });

  it("propertyValue on the result echoes the input value unchanged", () => {
    const result = calculateInsuranceEstimation(baseInput({ propertyValue: 612345 }));

    expect(result.propertyValue).toBe(612345);
  });

  it("returns every field defined on InsuranceEstimationResult", () => {
    const result = calculateInsuranceEstimation(baseInput());

    expect(result).toEqual(
      expect.objectContaining({
        propertyValue: expect.any(Number),
        estimatedAnnualInsurance: expect.any(Number),
        estimatedMonthlyInsurance: expect.any(Number),
        insuranceRatePercent: expect.any(Number),
        pmiRequired: expect.any(Boolean),
        totalAnnualInsurance: expect.any(Number),
        insuranceBreakdown: expect.any(Object),
        summary: expect.any(String),
        disclaimer: expect.any(String),
      })
    );
  });
});
