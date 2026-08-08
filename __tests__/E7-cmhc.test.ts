import { calculateCMHCPremium } from "../src/E7-cmhc";

describe("calculateCMHCPremium", () => {
  // Golden values per CMHC's published premium schedule for insured
  // mortgages (LTV bands over 80%, plus the 0.20% surcharge for
  // amortizations beyond 25 years).

  it("applies the 4.00% premium for the 90.01-95% LTV band", () => {
    const premium = calculateCMHCPremium({
      purchasePrice: 500000,
      downPaymentPercent: 0.05, // LTV 95%
      amortizationYears: 25,
    });

    expect(premium).toBeCloseTo(19000, 2);
  });

  it("applies the 3.10% premium for the 85.01-90% LTV band", () => {
    const premium = calculateCMHCPremium({
      purchasePrice: 500000,
      downPaymentPercent: 0.1, // LTV 90%
      amortizationYears: 25,
    });

    expect(premium).toBeCloseTo(13950, 2);
  });

  it("applies the 2.80% premium for the 80.01-85% LTV band", () => {
    const premium = calculateCMHCPremium({
      purchasePrice: 500000,
      downPaymentPercent: 0.15, // LTV 85%
      amortizationYears: 25,
    });

    expect(premium).toBeCloseTo(11900, 2);
  });

  it("adds the 0.20% surcharge for amortization beyond 25 years", () => {
    const premium = calculateCMHCPremium({
      purchasePrice: 500000,
      downPaymentPercent: 0.05, // LTV 95%
      amortizationYears: 30,
    });

    expect(premium).toBeCloseTo(19950, 2);
  });

  it("throws for LTV outside the insurable 80-95% range", () => {
    expect(() =>
      calculateCMHCPremium({
        purchasePrice: 500000,
        downPaymentPercent: 0.25, // LTV 75%, doesn't require CMHC insurance
        amortizationYears: 25,
      })
    ).toThrow();
  });
});
