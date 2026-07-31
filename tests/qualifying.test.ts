import { qualifyForMortgage } from "../src/qualifying";

describe("qualifyForMortgage", () => {
  // Golden values computed from the actual amortization formula (semi-annual
  // compounding) at the stress-tested qualifying rate of max(5.25%,
  // contract + 2%) = 6.5% for a 4.5% contract rate.

  it("qualifies when both GDS (<=39%) and TDS (<=44%) are within limits", () => {
    const result = qualifyForMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.045,
      amortizationYears: 25,
      annualPropertyTax: 3600,
      annualHeatingCost: 1200,
      otherMonthlyDebtPayments: 200,
      grossAnnualIncome: 120000,
    });

    expect(result.qualifyingRate).toBeCloseTo(0.065, 6);
    expect(result.monthlyMortgagePayment).toBeCloseTo(2143.44, 2);
    expect(result.gdsRatio).toBeCloseTo(0.2543, 4);
    expect(result.tdsRatio).toBeCloseTo(0.2743, 4);
    expect(result.gdsPass).toBe(true);
    expect(result.tdsPass).toBe(true);
    expect(result.qualifies).toBe(true);
  });

  it("fails on GDS when housing costs alone exceed 39% of income", () => {
    const result = qualifyForMortgage({
      purchasePrice: 500000,
      downPaymentPercent: 0.2,
      contractRate: 0.045,
      amortizationYears: 25,
      annualPropertyTax: 4800,
      annualHeatingCost: 1200,
      otherMonthlyDebtPayments: 0,
      grossAnnualIncome: 96000,
    });

    expect(result.gdsRatio).toBeCloseTo(0.3974, 4);
    expect(result.tdsRatio).toBeCloseTo(0.3974, 4);
    expect(result.gdsPass).toBe(false);
    expect(result.tdsPass).toBe(true);
    expect(result.qualifies).toBe(false);
  });

  it("fails on TDS when other debt pushes total obligations over 44% while GDS stays within limits", () => {
    const result = qualifyForMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.045,
      amortizationYears: 25,
      annualPropertyTax: 3600,
      annualHeatingCost: 1200,
      otherMonthlyDebtPayments: 2000,
      grossAnnualIncome: 120000,
    });

    expect(result.gdsRatio).toBeCloseTo(0.2543, 4);
    expect(result.tdsRatio).toBeCloseTo(0.4543, 4);
    expect(result.gdsPass).toBe(true);
    expect(result.tdsPass).toBe(false);
    expect(result.qualifies).toBe(false);
  });
});

describe("calculateStressTestRate", () => {
  it("uses the 5.25% floor when contract rate + 2% is below it", () => {
    const { qualifyingRate } = qualifyForMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.02, // + 2% = 4.0%, below the 5.25% floor
      amortizationYears: 25,
      annualPropertyTax: 3600,
      annualHeatingCost: 1200,
      otherMonthlyDebtPayments: 0,
      grossAnnualIncome: 120000,
    });

    expect(qualifyingRate).toBeCloseTo(0.0525, 6);
  });

  it("uses contract rate + 2% when it exceeds the 5.25% floor", () => {
    const { qualifyingRate } = qualifyForMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.045, // + 2% = 6.5%, above the 5.25% floor
      amortizationYears: 25,
      annualPropertyTax: 3600,
      annualHeatingCost: 1200,
      otherMonthlyDebtPayments: 0,
      grossAnnualIncome: 120000,
    });

    expect(qualifyingRate).toBeCloseTo(0.065, 6);
  });
});
