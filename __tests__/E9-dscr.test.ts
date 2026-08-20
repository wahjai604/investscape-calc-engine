/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateNOI, calculateDSCR, evaluateDSCR, calculateCapRate, calculateCashOnCash } from "../src/E9-dscr";

describe("calculateNOI", () => {
  it("subtracts vacancy allowance and operating expenses from gross rent", () => {
    const result = calculateNOI({
      grossAnnualRent: 100000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 30000,
    });

    // 100,000 - (100,000 * 5%) - 30,000 = 65,000
    expect(result.netOperatingIncome).toBeCloseTo(65000, 2);
    expect(result.operatingExpenses).toBe(30000);
    expect(result.expenseBreakdown).toBeUndefined();
  });

  it("accepts an itemized expense breakdown and returns the same NOI as the equivalent lump sum (parity check)", () => {
    const breakdown = {
      insurance: 4000,
      propertyManagement: 9000,
      propertyTaxes: 12000,
      repairsAndMaintenance: 3000,
      strataOrHOA: 1500,
      other: 500,
    };
    // Sums to 30,000 — same total as the lump-sum case above.
    const itemized = calculateNOI({
      grossAnnualRent: 100000,
      vacancyRatePercent: 0.05,
      operatingExpenses: breakdown,
    });
    const lumpSum = calculateNOI({
      grossAnnualRent: 100000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 30000,
    });

    expect(itemized.netOperatingIncome).toBeCloseTo(lumpSum.netOperatingIncome, 10);
    expect(itemized.operatingExpenses).toBe(30000);
    expect(itemized.expenseBreakdown).toEqual(breakdown);
  });
});

describe("calculateCapRate", () => {
  it("divides NOI by purchase price", () => {
    // 40,000 / 500,000 = 8%
    expect(calculateCapRate(40000, 500000)).toBeCloseTo(0.08, 6);
  });
});

describe("calculateCashOnCash", () => {
  it("divides first-year net cash flow by equity invested", () => {
    // 9,000 / 150,000 = 6%
    expect(calculateCashOnCash(9000, 150000)).toBeCloseTo(0.06, 6);
  });
});

describe("calculateDSCR", () => {
  it("divides NOI by annual debt service", () => {
    const dscr = calculateDSCR({
      netOperatingIncome: 111000,
      annualDebtService: 90000,
    });

    expect(dscr).toBeCloseTo(1.2333, 4);
  });
});

describe("evaluateDSCR", () => {
  it("flags a property meeting the 1.20 lender minimum", () => {
    const result = evaluateDSCR({
      grossAnnualRent: 180000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 60000,
      annualDebtService: 90000,
    });

    // NOI = 180,000 - 9,000 - 60,000 = 111,000; DSCR = 111,000 / 90,000 = 1.2333
    expect(result.netOperatingIncome).toBeCloseTo(111000, 2);
    expect(result.dscr).toBeCloseTo(1.2333, 4);
    expect(result.meetsLenderMinimum).toBe(true);
  });

  it("flags a property falling below the 1.20 lender minimum", () => {
    const result = evaluateDSCR({
      grossAnnualRent: 150000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 50000,
      annualDebtService: 90000,
    });

    // NOI = 150,000 - 7,500 - 50,000 = 92,500; DSCR = 92,500 / 90,000 = 1.0278
    expect(result.netOperatingIncome).toBeCloseTo(92500, 2);
    expect(result.dscr).toBeCloseTo(1.0278, 4);
    expect(result.meetsLenderMinimum).toBe(false);
  });
});
