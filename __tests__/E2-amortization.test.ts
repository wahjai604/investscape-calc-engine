/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import {
  amortizationSchedule,
  remainingBalance,
  trancheAmortizationSchedule,
  buildPresaleDepositSchedule,
  averageDrawFactor,
} from "../src/E2-amortization";
import { MortgageInput, Tranche } from "../src/types";

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
    const seniorDebt: Tranche = {
      type: "senior_debt",
      amount: 706000,
      rate: 0.0479,
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
    const equity: Tranche = {
      type: "equity",
      amount: 100000,
      rate: 0.06,
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
      const mezz: Tranche = { type: "mezzanine", amount: 100000, rate: 0.06, amortizationYears: 30 };
      const equity: Tranche = { type: "equity", amount: 100000, rate: 0.06, amortizationYears: 30 };

      expect(trancheAmortizationSchedule(mezz, "monthly")).toEqual(trancheAmortizationSchedule(equity, "monthly"));
    });
  });

  it("throws when amortizationYears is missing (the one runtime check standing in for the schema gap this type used to leave open)", () => {
    const noTerm: Tranche = { type: "senior_debt", amount: 100000, rate: 0.05 };
    expect(() => trancheAmortizationSchedule(noTerm)).toThrow(/amortizationYears/);
  });

  describe("drawMonth (delayed-draw facilities, e.g. a mezzanine drawing after the senior loan)", () => {
    it("drawMonth: 0 produces byte-identical rows to a tranche with no drawMonth field at all — regression guard for today's day-1-draw behavior", () => {
      const withZero: Tranche = { type: "senior_debt", amount: 706000, rate: 0.0479, amortizationYears: 25, drawMonth: 0 };
      const omitted: Tranche = { type: "senior_debt", amount: 706000, rate: 0.0479, amortizationYears: 25 };

      expect(trancheAmortizationSchedule(withZero, "monthly")).toEqual(trancheAmortizationSchedule(omitted, "monthly"));
    });

    it("a delayed-draw mezzanine (drawMonth: 6, 15yr term) sits at $0 through month 6, draws its full balance at month 7, and fully amortizes exactly 180 months after the draw", () => {
      const mezz: Tranche = { type: "mezzanine", amount: 1500000, rate: 0.12, amortizationYears: 15, drawMonth: 6 };
      const rows = trancheAmortizationSchedule(mezz, "monthly");

      // Months 1-6: undrawn, everything zero.
      const preDraw = rows.slice(0, 6);
      expect(preDraw).toHaveLength(6);
      for (const row of preDraw) {
        expect(row.beginningBalance).toBe(0);
        expect(row.payment).toBe(0);
        expect(row.principal).toBe(0);
        expect(row.interest).toBe(0);
        expect(row.endingBalance).toBe(0);
      }

      // Month 7 (period = drawMonth + 1): full balance draws and amortization begins.
      const drawRow = rows.find((row) => row.period === 7)!;
      expect(drawRow.beginningBalance).toBeCloseTo(1500000, 2);

      // Facility's own 15-year term runs from its own draw date: 6 + 180 = 186 total rows,
      // last row's period is 186 and it's fully amortized to ~$0.
      expect(rows).toHaveLength(6 + 15 * 12);
      const lastRow = rows[rows.length - 1];
      expect(lastRow.period).toBe(186);
      expect(lastRow.endingBalance).toBeCloseTo(0, 0);
    });
  });

  describe("interest_only_bullet (construction loan repaid from unit-sale proceeds)", () => {
    it("repaymentType omitted (or 'amortizing') produces byte-identical output to before this change — regression guard", () => {
      const omitted: Tranche = { type: "senior_debt", amount: 706000, rate: 0.0479, amortizationYears: 25 };
      const explicitAmortizing: Tranche = {
        type: "senior_debt",
        amount: 706000,
        rate: 0.0479,
        amortizationYears: 25,
        repaymentType: "amortizing",
      };

      expect(trancheAmortizationSchedule(explicitAmortizing, "monthly")).toEqual(
        trancheAmortizationSchedule(omitted, "monthly"),
      );
    });

    it("a day-1-draw senior_debt facility (24mo construction + 6mo sell-off) sits flat interest-only through month 29, then pays the full bullet at month 30 with endingBalance genuinely 0", () => {
      const senior: Tranche = {
        type: "senior_debt",
        amount: 6000000,
        rate: 0.08,
        repaymentType: "interest_only_bullet",
        drawMonth: 0,
        bulletRepaymentMonth: 30,
      };
      const rows = trancheAmortizationSchedule(senior, "monthly");

      expect(rows).toHaveLength(30);

      for (const row of rows.slice(0, 29)) {
        expect(row.beginningBalance).toBeCloseTo(6000000, 6);
        expect(row.endingBalance).toBeCloseTo(6000000, 6);
        expect(row.principal).toBe(0);
        expect(row.interest).toBeGreaterThan(0);
        expect(row.payment).toBeCloseTo(row.interest, 6);
      }

      const bulletRow = rows[29];
      expect(bulletRow.period).toBe(30);
      expect(bulletRow.principal).toBeCloseTo(6000000, 6);
      expect(bulletRow.endingBalance).toBe(0);
    });

    it("a delayed-draw mezzanine (drawMonth: 6) sits at $0 through month 6, then interest-only flat from month 7 through month 29, then bullets to endingBalance === 0 at month 30", () => {
      const mezz: Tranche = {
        type: "mezzanine",
        amount: 1500000,
        rate: 0.12,
        repaymentType: "interest_only_bullet",
        drawMonth: 6,
        bulletRepaymentMonth: 30,
      };
      const rows = trancheAmortizationSchedule(mezz, "monthly");

      const preDraw = rows.slice(0, 6);
      expect(preDraw).toHaveLength(6);
      for (const row of preDraw) {
        expect(row.beginningBalance).toBe(0);
        expect(row.payment).toBe(0);
        expect(row.principal).toBe(0);
        expect(row.interest).toBe(0);
        expect(row.endingBalance).toBe(0);
      }

      const flatRows = rows.slice(6, 29);
      expect(flatRows).toHaveLength(23);
      for (const row of flatRows) {
        expect(row.beginningBalance).toBeCloseTo(1500000, 6);
        expect(row.endingBalance).toBeCloseTo(1500000, 6);
        expect(row.principal).toBe(0);
      }

      const bulletRow = rows[rows.length - 1];
      expect(bulletRow.period).toBe(30);
      expect(bulletRow.principal).toBeCloseTo(1500000, 6);
      expect(bulletRow.endingBalance).toBe(0);
    });

    it("throws a clear error when bulletRepaymentMonth is missing", () => {
      const noBullet: Tranche = {
        type: "senior_debt",
        amount: 6000000,
        rate: 0.08,
        repaymentType: "interest_only_bullet",
      };
      expect(() => trancheAmortizationSchedule(noBullet, "monthly")).toThrow(/bulletRepaymentMonth/);
    });

    it("throws a clear error when bulletRepaymentMonth <= drawMonth", () => {
      const nonsensical: Tranche = {
        type: "senior_debt",
        amount: 6000000,
        rate: 0.08,
        repaymentType: "interest_only_bullet",
        drawMonth: 12,
        bulletRepaymentMonth: 12,
      };
      expect(() => trancheAmortizationSchedule(nonsensical, "monthly")).toThrow(/bulletRepaymentMonth/);
    });
  });

  describe("drawSchedule: scurve (progressive construction drawdown, opt-in)", () => {
    const flatSenior: Tranche = {
      type: "senior_debt",
      amount: 6000000,
      rate: 0.08,
      repaymentType: "interest_only_bullet",
      drawMonth: 0,
      bulletRepaymentMonth: 30,
    };

    it("drawSchedule omitted produces byte-identical rows to before this change — regression guard proving the default path is untouched", () => {
      const noDrawSchedule: Tranche = { ...flatSenior };
      const explicitFlat: Tranche = { ...flatSenior, drawSchedule: "flat" };

      const rows = trancheAmortizationSchedule(noDrawSchedule, "monthly");
      expect(rows).toHaveLength(30);
      for (const row of rows.slice(0, 29)) {
        expect(row.beginningBalance).toBeCloseTo(6000000, 6);
        expect(row.endingBalance).toBeCloseTo(6000000, 6);
        expect(row.principal).toBe(0);
      }
      expect(rows[29].principal).toBeCloseTo(6000000, 6);
      expect(rows[29].endingBalance).toBe(0);

      expect(trancheAmortizationSchedule(explicitFlat, "monthly")).toEqual(rows);
    });

    it("ramps beginningBalance along the smoothstep curve during construction, then sits flat once construction completes", () => {
      const scurve: Tranche = { ...flatSenior, drawSchedule: "scurve", constructionMonths: 12 };
      const rows = trancheAmortizationSchedule(scurve, "monthly");

      const smoothstep = (x: number) => 3 * x * x - 2 * x * x * x;

      // period = drawMonth + monthsIntoConstruction = 0 + 1 = 1
      const month1 = rows.find((r) => r.period === 1)!;
      expect(month1.beginningBalance).toBeCloseTo(6000000 * smoothstep(1 / 12), 2);
      expect(month1.beginningBalance).toBeLessThan(6000000 * 0.1);

      const month6 = rows.find((r) => r.period === 6)!;
      expect(month6.beginningBalance).toBeCloseTo(6000000 * smoothstep(6 / 12), 2);
      expect(month6.beginningBalance).toBeCloseTo(3000000, -3);

      const month12 = rows.find((r) => r.period === 12)!;
      expect(month12.beginningBalance).toBeCloseTo(6000000, 2);

      const month20 = rows.find((r) => r.period === 20)!;
      expect(month20.beginningBalance).toBeCloseTo(6000000, 2);
    });

    it("produces strictly less cumulative interest than an equivalent flat tranche, since average balance during ramp-up is lower", () => {
      const scurve: Tranche = { ...flatSenior, drawSchedule: "scurve", constructionMonths: 24 };
      const flat: Tranche = { ...flatSenior };

      const scurveInterest = trancheAmortizationSchedule(scurve, "monthly").reduce((sum, r) => sum + r.interest, 0);
      const flatInterest = trancheAmortizationSchedule(flat, "monthly").reduce((sum, r) => sum + r.interest, 0);

      expect(scurveInterest).toBeLessThan(flatInterest);
    });

    it("bullet repayment is unaffected by drawSchedule: final row still pays the full amount and ends at $0", () => {
      const scurve: Tranche = { ...flatSenior, drawSchedule: "scurve", constructionMonths: 24 };
      const rows = trancheAmortizationSchedule(scurve, "monthly");
      const bulletRow = rows[rows.length - 1];

      expect(bulletRow.period).toBe(30);
      expect(bulletRow.principal).toBeCloseTo(6000000, 6);
      expect(bulletRow.endingBalance).toBe(0);
    });

    it("throws when drawSchedule is 'scurve' but constructionMonths is missing", () => {
      const missing: Tranche = { ...flatSenior, drawSchedule: "scurve" };
      expect(() => trancheAmortizationSchedule(missing, "monthly")).toThrow(/constructionMonths/);
    });

    it("throws when constructionMonths exceeds the tranche's own term (bulletRepaymentMonth - drawMonth)", () => {
      const tooLong: Tranche = { ...flatSenior, drawSchedule: "scurve", constructionMonths: 31 };
      expect(() => trancheAmortizationSchedule(tooLong, "monthly")).toThrow(/constructionMonths/);
    });

    it("throws when drawSchedule is 'scurve' on a tranche whose repaymentType isn't interest_only_bullet", () => {
      const wrongRepaymentType: Tranche = {
        type: "senior_debt",
        amount: 706000,
        rate: 0.0479,
        amortizationYears: 25,
        drawSchedule: "scurve",
        constructionMonths: 12,
      };
      expect(() => trancheAmortizationSchedule(wrongRepaymentType, "monthly")).toThrow(/scurve/);
    });
  });
});

describe("averageDrawFactor", () => {
  it("converges toward 0.5 as constructionMonths grows, since the smoothstep curve is symmetric", () => {
    expect(averageDrawFactor(24)).toBeCloseTo(0.5, 1);
    expect(Math.abs(averageDrawFactor(24) - 0.5)).toBeLessThan(0.03);
  });

  it("throws for non-positive constructionMonths", () => {
    expect(() => averageDrawFactor(0)).toThrow(/constructionMonths/);
    expect(() => averageDrawFactor(-1)).toThrow(/constructionMonths/);
  });
});

describe("buildPresaleDepositSchedule", () => {
  // $1,000,000 facility @ 1%/yr (monthlyRate = 1/1200), releasing 30% from
  // month 1, 70% cumulative from month 7, 100% cumulative from month 13
  // (milestone.month is the first month a release applies, inclusive) —
  // hand-computed: months 1-6 draw $300,000 ($250.00/mo interest), months
  // 7-12 draw $700,000 ($583.33/mo), repaid in one bullet at month 12.
  const presale: Tranche = {
    type: "presale_deposit",
    amount: 1000000,
    rate: 0.01,
    milestones: [
      { month: 1, cumulativeReleasePercent: 0.3 },
      { month: 7, cumulativeReleasePercent: 0.7 },
      { month: 13, cumulativeReleasePercent: 1.0 },
    ],
  };

  it("steps drawnBalance up at each milestone rather than paying it down like a loan", () => {
    const rows = buildPresaleDepositSchedule(presale, 12);

    expect(rows.slice(0, 6).every((r) => r.drawnBalance === 300000)).toBe(true);
    expect(rows.slice(6, 12).every((r) => r.drawnBalance === 700000)).toBe(true);

    // Never declines, unlike a TrancheAmortizationRow endingBalance series.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].drawnBalance).toBeGreaterThanOrEqual(rows[i - 1].drawnBalance);
    }
  });

  it("never accrues interest, regardless of drawn balance — a presale deposit is trust-held buyer earnest money, not a loan the developer has drawn", () => {
    const rows = buildPresaleDepositSchedule(presale, 12);

    expect(rows.every((r) => r.interestAccrued === 0)).toBe(true);
    expect(rows.every((r) => r.cumulativeInterest === 0)).toBe(true);
  });

  it("ignores tranche.rate entirely for interest purposes: a nonzero rate still produces interestAccrued: 0 on every row", () => {
    const highRatePresale: Tranche = { ...presale, rate: 0.25 };
    const rows = buildPresaleDepositSchedule(highRatePresale, 12);

    expect(rows.every((r) => r.interestAccrued === 0)).toBe(true);
    expect(rows.every((r) => r.cumulativeInterest === 0)).toBe(true);
  });

  it("is repaid in a single bullet at the final period, not amortized down over several", () => {
    const rows = buildPresaleDepositSchedule(presale, 12);

    expect(rows.filter((r) => r.repaid)).toHaveLength(1);
    expect(rows[rows.length - 1].repaid).toBe(true);
    expect(rows.slice(0, -1).every((r) => !r.repaid)).toBe(true);
  });

  it("rejects a non-presale_deposit tranche and a presale_deposit tranche missing milestones", () => {
    const wrongType: Tranche = { type: "senior_debt", amount: 100000, rate: 0.05, amortizationYears: 10 };
    expect(() => buildPresaleDepositSchedule(wrongType, 12)).toThrow(/presale_deposit/);

    const noMilestones: Tranche = { type: "presale_deposit", amount: 100000, rate: 0.01 };
    expect(() => buildPresaleDepositSchedule(noMilestones, 12)).toThrow(/milestones/);
  });
});
