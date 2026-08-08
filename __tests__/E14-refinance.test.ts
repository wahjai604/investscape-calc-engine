import { calculateRefinance } from "../src/E14-refinance";
import { RefinanceInput } from "../src/types";
import { calculateMonthlyMortgagePayment, calculateMonthlyUSMortgagePayment } from "../src/E1-mortgage";

// $400K loan, 4.54% current rate (same rate as mortgage.test.ts's FCAC-validated
// golden case), 25 years remaining, refinancing to 3.5%, 5-year hold.
const rateDropInput: RefinanceInput = {
  currentLoanAmount: 400000,
  currentInterestRate: 0.0454,
  currentAmortizationRemaining: 25,
  newInterestRate: 0.035,
  newAmortizationYears: 25,
  holdPeriodYears: 5,
  country: "Canada",
  monthlyNOI: 3000,
};

describe("calculateRefinance", () => {
  it("rate drop scenario (4.54% → 3.5%, same 25yr): saves ~$225/month, break-even ~26 months, shouldRefinance: true", () => {
    const result = calculateRefinance(rateDropInput);

    expect(result.monthlyPaymentChange).toBeCloseTo(-225.71, 2);
    expect(result.breakEvenMonth).toBeCloseTo(26.58, 2);
    expect(result.breakEvenYears).toBeCloseTo(2.215, 3);
    expect(result.refinancingCosts).toBeCloseTo(6000, 2);
    expect(result.shouldRefinance).toBe(true);
  });

  it("rate drop + longer amortization (25yr → 30yr): bigger payment drop, faster break-even, shouldRefinance: true", () => {
    const sameTerm = calculateRefinance(rateDropInput);
    const longerTerm = calculateRefinance({ ...rateDropInput, newAmortizationYears: 30 });

    // Stretching the payout over more years shrinks the new payment further,
    // which means a bigger monthly saving and a faster recoup of the same
    // fixed-dollar refinancing cost.
    expect(Math.abs(longerTerm.monthlyPaymentChange)).toBeGreaterThan(Math.abs(sameTerm.monthlyPaymentChange));
    expect(longerTerm.breakEvenMonth).toBeLessThan(sameTerm.breakEvenMonth);
    expect(longerTerm.monthlyPaymentChange).toBeCloseTo(-432.25, 2);
    expect(longerTerm.breakEvenMonth).toBeCloseTo(13.88, 2);
    expect(longerTerm.shouldRefinance).toBe(true);
  });

  it("rate increase (don't refinance): breakEvenMonth/breakEvenYears are Infinity, shouldRefinance: false", () => {
    const result = calculateRefinance({ ...rateDropInput, newInterestRate: 0.055 });

    expect(result.monthlyPaymentChange).toBeGreaterThan(0);
    expect(result.breakEvenMonth).toBe(Infinity);
    expect(result.breakEvenYears).toBe(Infinity);
    expect(result.shouldRefinance).toBe(false);

    // totalSavingsOverHold/cashFlowImprovement must read as a net cost here
    // (negative), not a false "savings" — see the signed-vs-abs() note in
    // refinance.ts's JSDoc.
    expect(result.totalSavingsOverHold).toBeLessThan(0);
    expect(result.cashFlowImprovement).toBeLessThan(0);
  });

  describe("break-even boundary (strict <, around a 5-year / 60-month hold)", () => {
    // refinancingCostsPercent is chosen so break-even lands just outside vs.
    // just inside the 60-month hold, rather than asserting bit-exact
    // equality at 60.0 — floating-point round-trips (month/12*12) can't be
    // relied on to land on an exact boundary, so this tests the same
    // qualitative transition with a safe margin on each side instead.
    it("break-even just OVER the hold period (61 months vs. a 60-month hold) → not recommended", () => {
      const result = calculateRefinance({ ...rateDropInput, refinancingCostsPercent: 0.0344213900979 });

      expect(result.breakEvenMonth).toBeCloseTo(61, 1);
      expect(result.shouldRefinance).toBe(false);
    });

    it("break-even just UNDER the hold period (59 months vs. a 60-month hold) → recommended", () => {
      const result = calculateRefinance({ ...rateDropInput, refinancingCostsPercent: 0.0332928199308 });

      expect(result.breakEvenMonth).toBeCloseTo(59, 1);
      expect(result.shouldRefinance).toBe(true);
    });
  });

  it("high refinancing costs (3% vs 1.5%): break-even doubles (linear scaling)", () => {
    const lowCost = calculateRefinance({ ...rateDropInput, refinancingCostsPercent: 0.015 });
    const highCost = calculateRefinance({ ...rateDropInput, refinancingCostsPercent: 0.03 });

    expect(highCost.refinancingCosts).toBeCloseTo(lowCost.refinancingCosts * 2, 6);
    expect(highCost.breakEvenMonth).toBeCloseTo(lowCost.breakEvenMonth * 2, 6);
  });

  it("short hold period (1 year): shouldRefinance: false (refi costs not recouped)", () => {
    const result = calculateRefinance({ ...rateDropInput, holdPeriodYears: 1 });

    expect(result.shouldRefinance).toBe(false);
    // The refi is still a genuine rate drop (gross savings positive)...
    expect(result.cashFlowImprovement).toBeGreaterThan(0);
    // ...but the 1-year hold isn't long enough to recoup the fixed refinancing cost.
    expect(result.totalSavingsOverHold).toBeLessThan(0);
  });

  describe("US property (monthly compounding)", () => {
    const usInput: RefinanceInput = {
      currentLoanAmount: 400000,
      currentInterestRate: 0.065,
      currentAmortizationRemaining: 30,
      newInterestRate: 0.05,
      newAmortizationYears: 30,
      holdPeriodYears: 5,
      country: "US",
      monthlyNOI: 3000,
    };

    it("calculations use calculateMonthlyUSMortgagePayment (monthly compounding), not the Canadian semi-annual function", () => {
      const result = calculateRefinance(usInput);

      const expectedCurrent = calculateMonthlyUSMortgagePayment({
        purchasePrice: 400000,
        downPaymentPercent: 0,
        annualInterestRate: 0.065,
        amortizationYears: 30,
      });
      const expectedNew = calculateMonthlyUSMortgagePayment({
        purchasePrice: 400000,
        downPaymentPercent: 0,
        annualInterestRate: 0.05,
        amortizationYears: 30,
      });

      expect(result.currentMonthlyPayment).toBeCloseTo(expectedCurrent, 6);
      expect(result.newMonthlyPayment).toBeCloseTo(expectedNew, 6);

      // Proves the US path is genuinely used: the Canadian (semi-annual
      // compounding) function gives a materially different payment for the
      // same inputs, so this isn't just coincidentally correct either way.
      const wrongCanadianFigure = calculateMonthlyMortgagePayment({
        purchasePrice: 400000,
        downPaymentPercent: 0,
        annualInterestRate: 0.065,
        amortizationYears: 30,
      });
      expect(result.currentMonthlyPayment).not.toBeCloseTo(wrongCanadianFigure, 2);
    });

    it("produces a sensible refinance recommendation for the US scenario", () => {
      const result = calculateRefinance(usInput);

      expect(result.monthlyPaymentChange).toBeCloseTo(-380.99, 2);
      expect(result.breakEvenMonth).toBeCloseTo(15.75, 2);
      expect(result.shouldRefinance).toBe(true);
    });
  });

  describe("summary string", () => {
    it("recommended case includes the monthly savings, break-even months, and 'Recommended'", () => {
      const result = calculateRefinance(rateDropInput);

      expect(result.summary).toContain("225.71");
      expect(result.summary).toContain("26.6");
      expect(result.summary).toContain("Recommended");
      expect(result.summary).not.toContain("Not recommended");
    });

    it("rate-increase case explicitly says the payment doesn't go down", () => {
      const result = calculateRefinance({ ...rateDropInput, newInterestRate: 0.055 });

      expect(result.summary).toContain("Not recommended");
      expect(result.summary).toContain("does not lower your monthly payment");
    });

    it("short-hold case explains break-even exceeds the hold period", () => {
      const result = calculateRefinance({ ...rateDropInput, holdPeriodYears: 1 });

      expect(result.summary).toContain("Not recommended");
      expect(result.summary).toContain("exceeds your 1-year hold period");
    });

    it("includes the NOI-based cash flow context in every case", () => {
      const result = calculateRefinance(rateDropInput);
      expect(result.summary).toContain("Monthly cash flow (NOI");
    });
  });
});
