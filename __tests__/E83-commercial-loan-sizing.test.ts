/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateCommercialLoanSizing } from "../src/E83-commercial-loan-sizing";
import { presentValueFromPayment, semiAnnualToMonthlyRate, monthlyCompoundingRate } from "../src/E1-mortgage";

const BASE = {
  purchasePrice: 2_000_000,
  noi: 150_000,
  maxLtvPercent: 70,
  minDscr: 1.25,
  minDebtYieldPercent: 8,
  annualInterestRate: 0.06,
  amortizationYears: 25,
  country: "US" as const,
};

describe("calculateCommercialLoanSizing — each test independently", () => {
  it("LTV test: purchasePrice * (maxLtvPercent / 100)", () => {
    const result = calculateCommercialLoanSizing(BASE);
    expect(result.ltvMaxLoan).toBeCloseTo(2_000_000 * 0.7, 6);
  });

  it("debt yield test: noi / (minDebtYieldPercent / 100)", () => {
    const result = calculateCommercialLoanSizing(BASE);
    expect(result.debtYieldMaxLoan).toBeCloseTo(150_000 / 0.08, 6);
  });

  /**
   * DSCR test worked example — the standard commercial loan-sizing formula
   * (e.g. Brueggeman & Fisher, "Real Estate Finance and Investments":
   * maximum loan = maximum supportable annual debt service, converted to a
   * level monthly payment, then present-valued at the loan's rate/term —
   * the same annuity-PV formula this engine's presentValueFromPayment()
   * implements). Derived directly here (not from a rounded published
   * table) so the expected value matches the formula bit-for-bit:
   *   maxAnnualDebtService = 150,000 / 1.25 = 120,000
   *   maxMonthlyPayment = 120,000 / 12 = 10,000
   *   monthlyRate (US, 6%/yr) = 0.06 / 12 = 0.005
   *   nper = 25 * 12 = 300
   *   PV = 10,000 * (1 - 1.005^-300) / 0.005 ≈ 1,552,068.64
   */
  it("DSCR test: inverts the mortgage payment formula to solve for principal", () => {
    const result = calculateCommercialLoanSizing(BASE);
    const expected = presentValueFromPayment(0.06 / 12, 300, 10_000);
    expect(result.dscrMaxLoan).toBeCloseTo(expected, 2);
    expect(result.dscrMaxLoan).toBeCloseTo(1_552_068.64, 2);
  });
});

describe("calculateCommercialLoanSizing — bindingTest correctly identifies which test binds", () => {
  it("LTV binds when it produces the smallest raw max loan", () => {
    const result = calculateCommercialLoanSizing({
      purchasePrice: 1_000_000,
      noi: 200_000,
      maxLtvPercent: 50,
      minDscr: 1.25,
      minDebtYieldPercent: 8,
      annualInterestRate: 0.06,
      amortizationYears: 25,
      country: "US",
    });

    expect(result.ltvMaxLoan).toBeCloseTo(500_000, 2);
    expect(result.dscrMaxLoan).toBeGreaterThan(result.ltvMaxLoan);
    expect(result.debtYieldMaxLoan).toBeGreaterThan(result.ltvMaxLoan);
    expect(result.bindingTest).toBe("ltv");
    expect(result.sizedLoan).toBeCloseTo(500_000, 2);
    expect(result.wasClamped).toBe(false);
  });

  it("DSCR binds when a conservative minDscr produces the smallest raw max loan", () => {
    const result = calculateCommercialLoanSizing({
      purchasePrice: 5_000_000,
      noi: 300_000,
      maxLtvPercent: 75,
      minDscr: 1.5,
      minDebtYieldPercent: 6,
      annualInterestRate: 0.06,
      amortizationYears: 25,
      country: "US",
    });

    expect(result.ltvMaxLoan).toBeGreaterThan(result.dscrMaxLoan);
    expect(result.debtYieldMaxLoan).toBeGreaterThan(result.dscrMaxLoan);
    expect(result.bindingTest).toBe("dscr");
    expect(result.dscrMaxLoan).toBeCloseTo(2_586_781.07, 1);
    expect(result.sizedLoan).toBeCloseTo(result.dscrMaxLoan, 6);
    expect(result.wasClamped).toBe(false);
  });

  it("debt yield binds in a low-cap-rate market even when LTV and DSCR both look fine", () => {
    const result = calculateCommercialLoanSizing({
      purchasePrice: 3_000_000,
      noi: 200_000,
      maxLtvPercent: 75,
      minDscr: 1.1,
      minDebtYieldPercent: 12,
      annualInterestRate: 0.05,
      amortizationYears: 25,
      country: "US",
    });

    expect(result.ltvMaxLoan).toBeGreaterThan(result.debtYieldMaxLoan);
    expect(result.dscrMaxLoan).toBeGreaterThan(result.debtYieldMaxLoan);
    expect(result.bindingTest).toBe("debtYield");
    expect(result.debtYieldMaxLoan).toBeCloseTo(1_666_666.67, 1);
    expect(result.sizedLoan).toBeCloseTo(result.debtYieldMaxLoan, 6);
    expect(result.wasClamped).toBe(false);
  });
});

describe("calculateCommercialLoanSizing — Canada vs. US compounding", () => {
  it("produces different DSCR-test results for the same nominal rate (regression guard against sharing one rate conversion)", () => {
    const usResult = calculateCommercialLoanSizing({ ...BASE, country: "US" });
    const caResult = calculateCommercialLoanSizing({ ...BASE, country: "Canada" });

    expect(usResult.dscrMaxLoan).not.toBeCloseTo(caResult.dscrMaxLoan, 0);

    const usMonthlyRate = monthlyCompoundingRate(BASE.annualInterestRate);
    const caMonthlyRate = semiAnnualToMonthlyRate(BASE.annualInterestRate);
    expect(usResult.dscrMaxLoan).toBeCloseTo(presentValueFromPayment(usMonthlyRate, 300, 10_000), 2);
    expect(caResult.dscrMaxLoan).toBeCloseTo(presentValueFromPayment(caMonthlyRate, 300, 10_000), 2);

    // LTV and debt yield tests are rate-independent, so they must match across countries.
    expect(usResult.ltvMaxLoan).toBe(caResult.ltvMaxLoan);
    expect(usResult.debtYieldMaxLoan).toBe(caResult.debtYieldMaxLoan);
  });
});

describe("calculateCommercialLoanSizing — zero-interest-rate edge case", () => {
  it("DSCR test's PV inversion falls back to payment * nper when rate is 0", () => {
    const result = calculateCommercialLoanSizing({
      ...BASE,
      annualInterestRate: 0,
    });

    const maxAnnualDebtService = BASE.noi / BASE.minDscr;
    const maxMonthlyPayment = maxAnnualDebtService / 12;
    const expectedDscrMaxLoan = maxMonthlyPayment * (BASE.amortizationYears * 12);

    expect(result.dscrMaxLoan).toBeCloseTo(expectedDscrMaxLoan, 6);
  });
});

describe("calculateCommercialLoanSizing — clamping to [0, purchasePrice]", () => {
  it("clamps a negative binding result to 0 and flags wasClamped", () => {
    const result = calculateCommercialLoanSizing({
      purchasePrice: 1_000_000,
      noi: -50_000,
      maxLtvPercent: 70,
      minDscr: 1.25,
      minDebtYieldPercent: 8,
      annualInterestRate: 0.06,
      amortizationYears: 25,
      country: "US",
    });

    expect(result.rawSizedLoan).toBeLessThan(0);
    expect(result.bindingTest).toBe("debtYield");
    expect(result.sizedLoan).toBe(0);
    expect(result.wasClamped).toBe(true);
  });

  it("clamps a binding result that exceeds purchasePrice and flags wasClamped", () => {
    const result = calculateCommercialLoanSizing({
      purchasePrice: 500_000,
      noi: 1_000_000,
      maxLtvPercent: 150,
      minDscr: 1.0,
      minDebtYieldPercent: 1,
      annualInterestRate: 0.06,
      amortizationYears: 25,
      country: "US",
    });

    expect(result.rawSizedLoan).toBeGreaterThan(500_000);
    expect(result.bindingTest).toBe("ltv");
    expect(result.sizedLoan).toBe(500_000);
    expect(result.wasClamped).toBe(true);
  });

  it("does not flag wasClamped when the binding result already falls within [0, purchasePrice]", () => {
    const result = calculateCommercialLoanSizing(BASE);
    expect(result.wasClamped).toBe(false);
    expect(result.sizedLoan).toBe(result.rawSizedLoan);
  });
});
