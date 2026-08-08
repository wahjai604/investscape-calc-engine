/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { amortizationSchedule, remainingBalance, trancheAmortizationSchedule } from "../src/E2-amortization";
import { MortgageInput, AmortizingTranche } from "../src/types";

describe("amortizationSchedule / remainingBalance", () => {
  // Golden case from this session's Design work: $706,000 principal, 4.79%,
  // 25-year term, Canadian semi-annual compounding. MortgageInput has no
  // raw "principal" field, so it's expressed as purchasePrice with 0% down
  // — purchasePrice * (1 - downPaymentPercent) = 706000 either way.
  const loan: MortgageInput = {
    purchasePrice: 706000,
    downPaymentPercent: 0,
    annualInterestRate: 0.0479,
    amortizationYears: 25,
  };

  const fullSchedule = amortizationSchedule(loan, "Canada", 300);

  it("matches the independently hand-verified year-5 (month 60) balance of $622,781", () => {
    const month60 = fullSchedule.find((row) => row.month === 60);
    expect(month60?.closingBalance).toBeCloseTo(622781, 0);
  });

  it("reaches a $0 balance at the final row (month 300) of a fully amortizing loan", () => {
    const lastRow = fullSchedule[fullSchedule.length - 1];
    expect(lastRow.month).toBe(300);
    expect(lastRow.closingBalance).toBeCloseTo(0, 0);
  });

  it("pays off exactly the original principal across all rows summed", () => {
    const totalPrincipalPaid = fullSchedule.reduce((sum, row) => sum + row.principalPaid, 0);
    expect(totalPrincipalPaid).toBeCloseTo(706000, 0);
  });

  it("remainingBalance(loan, 60) agrees with amortizationSchedule(loan, 60)'s last row — same underlying logic, not two that could drift apart", () => {
    const scheduleTo60 = amortizationSchedule(loan, "Canada", 60);
    const balanceAt60 = remainingBalance(loan, "Canada", 60);

    expect(balanceAt60).toBe(scheduleTo60[scheduleTo60.length - 1].closingBalance);
  });
});

describe("trancheAmortizationSchedule", () => {
  describe("senior_debt (Canadian semi-annual compounding)", () => {
    // Same golden case as the whole-loan schedule above ($706,000 / 4.79% /
    // 25yr, independently hand-verified month-60 balance of $622,781) —
    // repackaged as a tranche (amount/annualRate instead of
    // purchasePrice/downPaymentPercent) rather than re-deriving a new
    // reference figure, since the underlying math is identical.
    const seniorDebt: AmortizingTranche = {
      type: "senior_debt",
      amount: 706000,
      annualRate: 0.0479,
      amortizationYears: 25,
    };

    it("matches the hand-verified month-60 balance of $622,781", () => {
      const rows = trancheAmortizationSchedule(seniorDebt, "monthly");
      const month60 = rows.find((row) => row.period === 60);
      expect(month60?.endingBalance).toBeCloseTo(622781, 0);
    });

    it("fully amortizes to a $0 balance at month 300", () => {
      const rows = trancheAmortizationSchedule(seniorDebt, "monthly");
      const lastRow = rows[rows.length - 1];
      expect(lastRow.period).toBe(300);
      expect(lastRow.endingBalance).toBeCloseTo(0, 0);
    });

    it("each row's beginningBalance matches the prior row's endingBalance", () => {
      const rows = trancheAmortizationSchedule(seniorDebt, "monthly");
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].beginningBalance).toBeCloseTo(rows[i - 1].endingBalance, 6);
      }
    });

    it("rolls up to a 25-row annual schedule whose year-5 ending balance matches the month-60 figure", () => {
      const annualRows = trancheAmortizationSchedule(seniorDebt, "annual");
      expect(annualRows).toHaveLength(25);
      expect(annualRows[4].period).toBe(5);
      expect(annualRows[4].endingBalance).toBeCloseTo(622781, 0);
    });
  });

  describe("equity (US monthly compounding)", () => {
    // Classic textbook reference (e.g. Ross, Corporate Finance): a $100,000
    // loan at 6% annual interest over 30 years, compounded monthly, has a
    // well-published $599.55/month payment. The month-12 and month-24
    // balances below were independently hand-computed month-by-month from
    // that same payment (balance -= payment - balance*rate), not derived
    // from this library, and are reproducible against any standard US
    // amortization calculator.
    const equity: AmortizingTranche = {
      type: "equity",
      amount: 100000,
      annualRate: 0.06,
      amortizationYears: 30,
    };

    it("matches the published $599.55/month payment", () => {
      const rows = trancheAmortizationSchedule(equity, "monthly");
      expect(rows[0].payment).toBeCloseTo(599.55, 2);
    });

    it("matches the independently hand-computed month-12 balance of $98,771.99", () => {
      const rows = trancheAmortizationSchedule(equity, "monthly");
      const month12 = rows.find((row) => row.period === 12);
      expect(month12?.endingBalance).toBeCloseTo(98771.99, 2);
    });

    it("matches the independently hand-computed month-24 balance of $97,468.24", () => {
      const rows = trancheAmortizationSchedule(equity, "monthly");
      const month24 = rows.find((row) => row.period === 24);
      expect(month24?.endingBalance).toBeCloseTo(97468.24, 2);
    });

    it("fully amortizes to a $0 balance at month 360", () => {
      const rows = trancheAmortizationSchedule(equity, "monthly");
      const lastRow = rows[rows.length - 1];
      expect(lastRow.period).toBe(360);
      expect(lastRow.endingBalance).toBeCloseTo(0, 0);
    });
  });

  describe("mezzanine (falls back to US monthly, like equity)", () => {
    it("produces the same schedule as an equity tranche with identical amount/rate/term", () => {
      const mezz: AmortizingTranche = { type: "mezzanine", amount: 100000, annualRate: 0.06, amortizationYears: 30 };
      const equity: AmortizingTranche = { type: "equity", amount: 100000, annualRate: 0.06, amortizationYears: 30 };

      expect(trancheAmortizationSchedule(mezz, "monthly")).toEqual(trancheAmortizationSchedule(equity, "monthly"));
    });
  });
});
