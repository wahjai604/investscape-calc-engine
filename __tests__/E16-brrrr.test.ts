import { calculateBRRRR } from "../src/E16-brrrr";
import { BRRRRInput } from "../src/types";

// Shared across every scenario: rehab/hold timeline, refinance terms, and the
// original acquisition loan's own rate/term (needed to run amortization.ts's
// remainingBalance() — see the JSDoc on BRRRRInput for why this field exists
// despite not being in the original E19 field list).
const commonAssumptions = {
  rehab_timeline_months: 3,
  holdPeriodBeforeRefinanceMonths: 6,
  refinanceInterestRate: 0.045,
  refinanceAmortizationYears: 30,
  country: "US" as const,
  originalInterestRate: 0.08,
  originalAmortizationYears: 30,
};

describe("calculateBRRRR", () => {
  // NOTE on scenario numbers: the originally-drafted "happy path" and "max
  // leverage" cases (both at a $450K ARV) were verified by hand and by
  // running the actual code to NOT produce cashReturnMultiple > 1.0 — 75%
  // LTV of $450K ($337,500) doesn't even cover the $300K purchase + $80K
  // rehab + closing costs, let alone return a profit. At 75% LTV, this
  // formula needs meaningfully more forced appreciation than $450K gives to
  // ever cross 1.0x. The scenarios below use a $560K ARV instead (still
  // $300K purchase / $80K rehab, i.e. $180K of forced appreciation created)
  // — independently confirmed by running calculateBRRRR() before writing
  // these assertions, not reverse-engineered from an expected pass/fail.

  it("1. happy path (real forced appreciation): cashReturnMultiple > 1.0, monthly CF positive", () => {
    const input: BRRRRInput = {
      ...commonAssumptions,
      purchasePrice: 300000,
      downPaymentPercent: 0.2,
      rehab_cost: 80000,
      afterRepairValue: 560000,
      newMonthlyRent: 3200,
    };
    const result = calculateBRRRR(input);

    expect(result.totalCashInvested).toBeCloseTo(146000, 2); // 60,000 down + 80,000 rehab + 6,000 (2% of 300K) closing
    expect(result.cashReturnMultiple).toBeGreaterThan(1.0);
    expect(result.cashReturnMultiple).toBeCloseTo(1.1999, 3);
    expect(result.monthlyPositiveCashFlow).toBeGreaterThan(0);
    expect(result.monthlyPositiveCashFlow).toBeCloseTo(111.92, 2);
  });

  it("2. break-even (no forced appreciation): cashReturnMultiple in 0.3-0.5, monthly CF negative", () => {
    const input: BRRRRInput = {
      ...commonAssumptions,
      purchasePrice: 300000,
      downPaymentPercent: 0.2,
      rehab_cost: 100000,
      afterRepairValue: 400000, // 400K - 300K - 100K = $0 of forced appreciation
      newMonthlyRent: 2000,
    };
    const result = calculateBRRRR(input);

    expect(result.cashReturnMultiple).toBeGreaterThanOrEqual(0.3);
    expect(result.cashReturnMultiple).toBeLessThanOrEqual(0.5);
    expect(result.cashReturnMultiple).toBeCloseTo(0.3433, 3);
    expect(result.monthlyPositiveCashFlow).toBeLessThan(0);
    expect(result.monthlyPositiveCashFlow).toBeCloseTo(-120.06, 2);
  });

  it("3. positive cash flow (good rent): monthlyPositiveCashFlow positive after refinance", () => {
    const input: BRRRRInput = {
      ...commonAssumptions,
      purchasePrice: 250000,
      downPaymentPercent: 0.2,
      rehab_cost: 50000,
      afterRepairValue: 350000, // creates $50K of forced appreciation
      newMonthlyRent: 2500,
    };
    const result = calculateBRRRR(input);

    expect(result.totalCashInvested).toBeCloseTo(105000, 2); // 50,000 down + 50,000 rehab + 5,000 (2% of 250K) closing
    expect(result.monthlyPositiveCashFlow).toBeGreaterThan(0);
    expect(result.monthlyPositiveCashFlow).toBeCloseTo(419.95, 2);
  });

  it("4. constrained refinance (low ARV): cashReturnMultiple < 1.0, limited proceeds", () => {
    const input: BRRRRInput = {
      ...commonAssumptions,
      purchasePrice: 300000,
      downPaymentPercent: 0.25,
      rehab_cost: 50000,
      afterRepairValue: 330000,
      newMonthlyRent: 1800,
    };
    const result = calculateBRRRR(input);

    expect(result.cashReturnMultiple).toBeLessThan(1.0);
    expect(result.cashReturnMultiple).toBeCloseTo(0.1541, 3);
    // "Can't cash out much": proceeds are a small fraction of what was put in.
    expect(result.cashReturnedToInvestor).toBeLessThan(result.totalCashInvested * 0.25);
    expect(result.refinanceLoanAmount).toBeCloseTo(247500, 2); // 330,000 * 0.75
  });

  it("5. max leverage (0% down): cashReturnMultiple > 1.0 — and higher than the 20%-down happy-path case at the same ARV", () => {
    const input: BRRRRInput = {
      ...commonAssumptions,
      purchasePrice: 300000,
      downPaymentPercent: 0,
      rehab_cost: 80000, // funded separately in cash, same as every other scenario — rehab is never rolled into the original loan
      afterRepairValue: 560000,
      newMonthlyRent: 3200,
    };
    const result = calculateBRRRR(input);

    expect(result.totalCashInvested).toBeCloseTo(86000, 2); // $0 down + 80,000 rehab + 6,000 closing — no down payment cash at all
    expect(result.cashReturnMultiple).toBeGreaterThan(1.0);
    expect(result.cashReturnMultiple).toBeCloseTo(1.3437, 3);

    // Same $300K/$80K/$560K deal as scenario 1, but 0% down instead of 20%.
    // At this ARV, less down payment produces a HIGHER multiple: down-payment
    // cash and the reduced original-loan payoff are dollar-for-dollar linked
    // (both scale with purchasePrice), but rehab + purchase closing costs are
    // a fixed baseline independent of down%. When the forced-appreciation
    // value created comfortably exceeds that fixed baseline (as it does
    // here), diluting the ratio with more down-payment cash pulls the
    // multiple down, not up — confirmed by running both variants, not
    // assumed from "more leverage = more return" intuition alone.
    const twentyPercentDownInput: BRRRRInput = { ...input, downPaymentPercent: 0.2 };
    const twentyPercentDownResult = calculateBRRRR(twentyPercentDownInput);
    expect(result.cashReturnMultiple).toBeGreaterThan(twentyPercentDownResult.cashReturnMultiple);

    // The refinance loan amount (ARV × LTV) doesn't depend on the original
    // down payment at all, so the payment — and therefore monthly cash flow —
    // is identical between the 0% and 20% down variants of the same deal.
    expect(result.newMonthlyPayment).toBeCloseTo(twentyPercentDownResult.newMonthlyPayment, 6);
    expect(result.monthlyPositiveCashFlow).toBeCloseTo(twentyPercentDownResult.monthlyPositiveCashFlow, 6);
  });

  describe("cashReturnMultiple formula verification", () => {
    it("equals cashReturnedToInvestor / totalCashInvested exactly", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 300000,
        downPaymentPercent: 0.2,
        rehab_cost: 80000,
        afterRepairValue: 560000,
        newMonthlyRent: 3200,
      };
      const result = calculateBRRRR(input);
      expect(result.cashReturnMultiple).toBe(result.cashReturnedToInvestor / result.totalCashInvested);
    });

    it("cashReturnedToInvestor equals refinanceLoanProceeds minus 1.5% refinance closing costs", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 300000,
        downPaymentPercent: 0.2,
        rehab_cost: 100000,
        afterRepairValue: 400000,
        newMonthlyRent: 2000,
      };
      const result = calculateBRRRR(input);
      const expectedRefinanceCosts = result.refinanceLoanAmount * 0.015;
      expect(result.cashReturnedToInvestor).toBeCloseTo(result.refinanceLoanProceeds - expectedRefinanceCosts, 6);
    });

    it("refinanceLoanProceeds equals refinanceLoanAmount minus the original loan's remaining balance at the refinance date", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 300000,
        downPaymentPercent: 0.2,
        rehab_cost: 80000,
        afterRepairValue: 560000,
        newMonthlyRent: 3200,
      };
      const result = calculateBRRRR(input);
      const impliedOriginalRemainingBalance = result.refinanceLoanAmount - result.refinanceLoanProceeds;

      // Sanity bounds: 9 months (3 rehab + 6 hold) into a 30yr loan, the
      // balance should still be very close to the original principal
      // (300,000 * 0.8 = 240,000) — only a small amount of paydown so far.
      expect(impliedOriginalRemainingBalance).toBeLessThan(240000);
      expect(impliedOriginalRemainingBalance).toBeGreaterThan(238000);
    });

    it("refinanceLoanAmount respects a custom refinanceLTVPercent (defaults to 0.75)", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 300000,
        downPaymentPercent: 0.2,
        rehab_cost: 80000,
        afterRepairValue: 560000,
        newMonthlyRent: 3200,
      };
      const defaultLTV = calculateBRRRR(input);
      const customLTV = calculateBRRRR({ ...input, refinanceLTVPercent: 0.7 });

      expect(defaultLTV.refinanceLoanAmount).toBeCloseTo(560000 * 0.75, 6);
      expect(customLTV.refinanceLoanAmount).toBeCloseTo(560000 * 0.7, 6);
      expect(customLTV.refinanceLoanAmount).toBeLessThan(defaultLTV.refinanceLoanAmount);
    });
  });

  describe("monthly cash flow calculation", () => {
    it("monthlyPositiveCashFlow equals (70% of gross rent as NOI, /12) minus newMonthlyPayment", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 250000,
        downPaymentPercent: 0.2,
        rehab_cost: 50000,
        afterRepairValue: 350000,
        newMonthlyRent: 2500,
      };
      const result = calculateBRRRR(input);
      const expectedMonthlyNOI = (2500 * 12 * 0.7) / 12; // = 2500 * 0.7 = 1,750

      expect(expectedMonthlyNOI).toBeCloseTo(1750, 6);
      expect(result.monthlyPositiveCashFlow).toBeCloseTo(expectedMonthlyNOI - result.newMonthlyPayment, 6);
    });

    it("capRate equals annual NOI (70% of gross rent) divided by afterRepairValue", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 250000,
        downPaymentPercent: 0.2,
        rehab_cost: 50000,
        afterRepairValue: 350000,
        newMonthlyRent: 2500,
      };
      const result = calculateBRRRR(input);
      const expectedCapRate = (2500 * 12 * 0.7) / 350000;

      expect(result.capRate).toBeCloseTo(expectedCapRate, 6);
      expect(result.capRate).toBeCloseTo(0.06, 6);
    });

    it("monthlyRent echoes the input's newMonthlyRent unchanged", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 250000,
        downPaymentPercent: 0.2,
        rehab_cost: 50000,
        afterRepairValue: 350000,
        newMonthlyRent: 2500,
      };
      expect(calculateBRRRR(input).monthlyRent).toBe(2500);
    });
  });

  describe("summary string", () => {
    it("includes total cash invested, cash returned, and monthly cash flow", () => {
      const input: BRRRRInput = {
        ...commonAssumptions,
        purchasePrice: 300000,
        downPaymentPercent: 0.2,
        rehab_cost: 80000,
        afterRepairValue: 560000,
        newMonthlyRent: 3200,
      };
      const result = calculateBRRRR(input);

      expect(result.summary).toContain(result.totalCashInvested.toFixed(2));
      expect(result.summary).toContain(result.cashReturnedToInvestor.toFixed(2));
      expect(result.summary).toContain(result.monthlyPositiveCashFlow.toFixed(2));
    });
  });
});
