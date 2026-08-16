/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import {
  calculateUSDTITier,
  checkConformingLoanLimit,
  qualifyForUSMortgage,
} from "../src/E73-us-qualifying";

describe("checkConformingLoanLimit", () => {
  it("does not exceed the limit at exactly the standard conforming loan amount", () => {
    const result = checkConformingLoanLimit(832750, false);
    expect(result.applicableLimit).toBe(832750);
    expect(result.exceedsConformingLimit).toBe(false);
  });

  it("exceeds the limit one dollar over the standard conforming amount", () => {
    const result = checkConformingLoanLimit(832751, false);
    expect(result.exceedsConformingLimit).toBe(true);
  });

  it("does not exceed the limit at exactly the high-cost-area threshold", () => {
    const result = checkConformingLoanLimit(1249125, true);
    expect(result.applicableLimit).toBe(1249125);
    expect(result.exceedsConformingLimit).toBe(false);
  });

  it("a loan under the high-cost limit would exceed the standard limit if it weren't high-cost", () => {
    const standard = checkConformingLoanLimit(1000000, false);
    const highCost = checkConformingLoanLimit(1000000, true);
    expect(standard.exceedsConformingLimit).toBe(true);
    expect(highCost.exceedsConformingLimit).toBe(false);
  });
});

describe("calculateUSDTITier — compensating-factor logic actually changes the applicable tier", () => {
  it("manual underwriting with no compensating factor caps at 36%", () => {
    const result = calculateUSDTITier({
      underwritingPath: "manual",
      creditScore: 650,
      reserveMonths: 3,
      loanToValuePercent: 0.85,
    });
    expect(result.compensatingFactorMet).toBe(false);
    expect(result.maxDTIRatio).toBe(0.36);
    expect(result.tierLabel).toBe("manual_baseline");
  });

  it("manual underwriting extends to 45% when credit score alone meets the compensating threshold", () => {
    const result = calculateUSDTITier({
      underwritingPath: "manual",
      creditScore: 700,
      reserveMonths: 3,
      loanToValuePercent: 0.85,
    });
    expect(result.compensatingFactorMet).toBe(true);
    expect(result.maxDTIRatio).toBe(0.45);
    expect(result.tierLabel).toBe("manual_compensating");
  });

  it("manual underwriting extends to 45% when reserve months alone meets the compensating threshold", () => {
    const result = calculateUSDTITier({
      underwritingPath: "manual",
      creditScore: 650,
      reserveMonths: 8,
      loanToValuePercent: 0.85,
    });
    expect(result.compensatingFactorMet).toBe(true);
    expect(result.maxDTIRatio).toBe(0.45);
  });

  it("manual underwriting extends to 45% when LTV alone meets the compensating threshold", () => {
    const result = calculateUSDTITier({
      underwritingPath: "manual",
      creditScore: 650,
      reserveMonths: 3,
      loanToValuePercent: 0.7,
    });
    expect(result.compensatingFactorMet).toBe(true);
    expect(result.maxDTIRatio).toBe(0.45);
  });

  it("automated underwriting always caps at 50%, regardless of credit/reserves/LTV", () => {
    const result = calculateUSDTITier({
      underwritingPath: "automated",
      creditScore: 600,
      reserveMonths: 0,
      loanToValuePercent: 0.95,
    });
    expect(result.maxDTIRatio).toBe(0.5);
    expect(result.tierLabel).toBe("automated");
  });
});

describe("qualifyForUSMortgage", () => {
  it("computes the back-end DTI ratio, flags the applicable tier, and checks the conforming limit together", () => {
    const result = qualifyForUSMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.065,
      amortizationYears: 30,
      annualPropertyTax: 4800,
      annualHomeownersInsurance: 1800,
      monthlyHOADues: 100,
      otherMonthlyDebtPayments: 300,
      grossAnnualIncome: 120000,
      underwritingPath: "manual",
      creditScore: 700,
      reserveMonths: 3,
      isHighCostArea: false,
    });

    expect(result.dtiTier.tierLabel).toBe("manual_compensating");
    expect(result.monthlyMortgagePayment).toBeCloseTo(2022.62, 2);
    expect(result.backEndDTIRatio).toBeCloseTo(0.2973, 4);
    expect(result.dtiPass).toBe(true);
    expect(result.qualifies).toBe(true);
    expect(result.conformingLoanLimitCheck.loanAmount).toBe(320000);
    expect(result.conformingLoanLimitCheck.exceedsConformingLimit).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it("flags when the loan amount exceeds the conforming limit and would need jumbo financing", () => {
    const result = qualifyForUSMortgage({
      purchasePrice: 1200000,
      downPaymentPercent: 0.2,
      contractRate: 0.065,
      amortizationYears: 30,
      annualPropertyTax: 12000,
      annualHomeownersInsurance: 3000,
      otherMonthlyDebtPayments: 0,
      grossAnnualIncome: 400000,
      underwritingPath: "automated",
      creditScore: 780,
      reserveMonths: 12,
      isHighCostArea: false,
    });

    expect(result.conformingLoanLimitCheck.loanAmount).toBe(960000);
    expect(result.conformingLoanLimitCheck.exceedsConformingLimit).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("jumbo financing")])
    );
  });

  it("100% of HOA dues count toward DTI, unlike Canadian GDS's 50% condo-fee treatment", () => {
    const withoutHOA = qualifyForUSMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.065,
      amortizationYears: 30,
      annualPropertyTax: 4800,
      annualHomeownersInsurance: 1800,
      otherMonthlyDebtPayments: 300,
      grossAnnualIncome: 120000,
      underwritingPath: "manual",
      creditScore: 700,
      reserveMonths: 3,
      isHighCostArea: false,
    });
    const withHOA = qualifyForUSMortgage({
      purchasePrice: 400000,
      downPaymentPercent: 0.2,
      contractRate: 0.065,
      amortizationYears: 30,
      annualPropertyTax: 4800,
      annualHomeownersInsurance: 1800,
      monthlyHOADues: 200,
      otherMonthlyDebtPayments: 300,
      grossAnnualIncome: 120000,
      underwritingPath: "manual",
      creditScore: 700,
      reserveMonths: 3,
      isHighCostArea: false,
    });

    const monthlyIncome = 120000 / 12;
    expect(withHOA.backEndDTIRatio - withoutHOA.backEndDTIRatio).toBeCloseTo(200 / monthlyIncome, 6);
  });

  it("folds an optional monthlyMortgageInsurance figure into the back-end DTI numerator when supplied", () => {
    const base = { ...baseInputWithoutMI() };
    const withoutMI = qualifyForUSMortgage(base);
    const withMI = qualifyForUSMortgage({ ...base, monthlyMortgageInsurance: 150 });

    const monthlyIncome = base.grossAnnualIncome / 12;
    expect(withMI.backEndDTIRatio - withoutMI.backEndDTIRatio).toBeCloseTo(150 / monthlyIncome, 6);
  });
});

function baseInputWithoutMI() {
  return {
    purchasePrice: 400000,
    downPaymentPercent: 0.2,
    contractRate: 0.065,
    amortizationYears: 30,
    annualPropertyTax: 4800,
    annualHomeownersInsurance: 1800,
    otherMonthlyDebtPayments: 300,
    grossAnnualIncome: 120000,
    underwritingPath: "manual" as const,
    creditScore: 700,
    reserveMonths: 3,
    isHighCostArea: false,
  };
}
