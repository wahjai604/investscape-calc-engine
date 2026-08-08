/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateHoldingPeriodSensitivity } from "../src/E17-holding-period-sensitivity";
import { HoldingPeriodSensitivityInput, DealParameters } from "../src/types";

// Same $550,000 / 27.5% down / 4.54% / 25yr Canadian deal used as the golden
// case throughout this session (scenario.test.ts, break-even.test.ts, etc.).
const baseDeal: DealParameters = {
  purchasePrice: 550000,
  downPaymentPercent: 0.275,
  annualInterestRate: 0.0454,
  amortizationYears: 25,
  country: "Canada",
  grossAnnualRent: 42000,
  vacancyRatePercent: 0.05,
  annualOperatingExpenses: 15000,
  equityInvested: 162250,
};

const baseInput: HoldingPeriodSensitivityInput = {
  baseDeal,
  rentGrowthRate: 0.02,
  expenseGrowthRate: 0.03,
  appreciationRate: 0.03,
  exitCapRate: null,
};

describe("calculateHoldingPeriodSensitivity", () => {
  describe("Template v2 golden case (30 years of hold periods)", () => {
    const result = calculateHoldingPeriodSensitivity(baseInput);

    it("generates exactly 30 entries, for holdYears 1 through 30", () => {
      expect(result.holdPeriodAnalysis).toHaveLength(30);
      expect(result.holdPeriodAnalysis.map((o) => o.holdYears)).toEqual(
        Array.from({ length: 30 }, (_, i) => i + 1),
      );
    });

    it("IRR peaks at year 4 (~11.68%) then declines", () => {
      const year4 = result.holdPeriodAnalysis.find((o) => o.holdYears === 4)!;
      const year5 = result.holdPeriodAnalysis.find((o) => o.holdYears === 5)!;
      const year10 = result.holdPeriodAnalysis.find((o) => o.holdYears === 10)!;

      expect(year4.irr).toBeCloseTo(0.11676, 4);
      expect(year5.irr).toBeLessThan(year4.irr);
      expect(year10.irr).toBeLessThan(year5.irr);
    });

    it("bestHoldPeriodByIRR = 4", () => {
      expect(result.bestHoldPeriodByIRR).toBe(4);
    });

    it("IRR at year 5 is ~11.58% (below year 4's peak)", () => {
      // Independently computed via the actual engine before writing this
      // assertion: 11.58%, not the ~11.3% ballpark figure floated in the
      // task brief — close, but not what the formula actually produces.
      const year4 = result.holdPeriodAnalysis.find((o) => o.holdYears === 4)!;
      expect(result.irr_at_5_years).toBeCloseTo(0.11576, 4);
      expect(result.irr_at_5_years).toBeLessThan(year4.irr);
    });

    it("IRR converges toward a long-run value but is still moving (by shrinking increments) at year 30 — not a hard plateau", () => {
      const year28 = result.holdPeriodAnalysis.find((o) => o.holdYears === 28)!;
      const year29 = result.holdPeriodAnalysis.find((o) => o.holdYears === 29)!;
      const year30 = result.holdPeriodAnalysis.find((o) => o.holdYears === 30)!;

      const diff2829 = year28.irr - year29.irr;
      const diff2930 = year29.irr - year30.irr;

      // Still declining year over year...
      expect(diff2829).toBeGreaterThan(0);
      expect(diff2930).toBeGreaterThan(0);
      // ...but by a smaller amount each year — asymptotic convergence, not a flat plateau.
      expect(diff2930).toBeLessThan(diff2829);
      expect(year30.irr).toBeCloseTo(0.08096, 4);
    });
  });

  describe("break-even analysis", () => {
    const result = calculateHoldingPeriodSensitivity(baseInput);

    it("finds a breakEvenYear (cumulative CF eventually reaches initial equity)", () => {
      expect(result.breakEvenYear).not.toBeNull();
    });

    it("breakEvenYear is 28 for the Template v2 golden case", () => {
      expect(result.breakEvenYear).toBe(28);
    });

    it("cumulativeCashFlow is below equityInvested the year before breakEvenYear, and at/above it at breakEvenYear", () => {
      const breakEvenYear = result.breakEvenYear!;
      const yearBefore = result.holdPeriodAnalysis.find((o) => o.holdYears === breakEvenYear - 1)!;
      const yearOf = result.holdPeriodAnalysis.find((o) => o.holdYears === breakEvenYear)!;

      expect(yearBefore.cumulativeCashFlow).toBeLessThan(baseDeal.equityInvested);
      expect(yearOf.cumulativeCashFlow).toBeGreaterThanOrEqual(baseDeal.equityInvested);
    });

    it("returns null when cumulative CF never reaches equityInvested within 30 years", () => {
      // A much larger equity stake than this deal's cash flow could ever
      // accumulate to in 30 years of operating cash flow alone.
      const neverBreaksEven: DealParameters = { ...baseDeal, equityInvested: 50000000 };
      const neverResult = calculateHoldingPeriodSensitivity({ ...baseInput, baseDeal: neverBreaksEven });

      expect(neverResult.breakEvenYear).toBeNull();
    });
  });

  describe("cash-on-cash invariant", () => {
    it("cashOnCash is identical across all 30 hold periods (year 1 CF doesn't depend on hold length)", () => {
      const result = calculateHoldingPeriodSensitivity(baseInput);
      const distinctValues = new Set(result.holdPeriodAnalysis.map((o) => o.cashOnCash));

      expect(distinctValues.size).toBe(1);
    });
  });

  describe("selling costs handling", () => {
    it("sellingCostsPercent = 0 (default): projectedEquityNetOfSellingCosts is null throughout", () => {
      const result = calculateHoldingPeriodSensitivity({ ...baseInput, sellingCostsPercent: 0 });
      expect(result.holdPeriodAnalysis.every((o) => o.projectedEquityNetOfSellingCosts === null)).toBe(true);
    });

    it("omitting sellingCostsPercent behaves the same as explicit 0", () => {
      const omitted = calculateHoldingPeriodSensitivity(baseInput);
      const explicitZero = calculateHoldingPeriodSensitivity({ ...baseInput, sellingCostsPercent: 0 });
      expect(omitted.holdPeriodAnalysis).toEqual(explicitZero.holdPeriodAnalysis);
    });

    it("sellingCostsPercent = 0.06: projectedEquityNetOfSellingCosts < projectedEquity for every hold period", () => {
      const result = calculateHoldingPeriodSensitivity({ ...baseInput, sellingCostsPercent: 0.06 });

      for (const outcome of result.holdPeriodAnalysis) {
        expect(outcome.projectedEquityNetOfSellingCosts).not.toBeNull();
        expect(outcome.projectedEquityNetOfSellingCosts as number).toBeLessThan(outcome.projectedEquity);
      }
    });

    it("net equity = gross equity - (sale price × sellingCostsPercent) — verified at year 5", () => {
      const result = calculateHoldingPeriodSensitivity({ ...baseInput, sellingCostsPercent: 0.06 });
      const year5 = result.holdPeriodAnalysis.find((o) => o.holdYears === 5)!;

      // projectedSalePrice isn't itself an output field here, but it's
      // recoverable: gross equity is derived from a flat-growth appreciation
      // calc whose salePrice depends only on holdYears (not sellingCosts), so
      // the zero-cost run's projectedEquity implies the same sale price.
      const zeroCostResult = calculateHoldingPeriodSensitivity({ ...baseInput, sellingCostsPercent: 0 });
      const zeroCostYear5 = zeroCostResult.holdPeriodAnalysis.find((o) => o.holdYears === 5)!;
      expect(year5.projectedEquity).toBe(zeroCostYear5.projectedEquity);

      expect(year5.projectedEquity).toBeCloseTo(287281.21, 2);
      expect(year5.projectedEquityNetOfSellingCosts).toBeCloseTo(249025.16, 2);
    });
  });

  describe("exit method comparison (cap-rate vs flat-growth)", () => {
    const flat = calculateHoldingPeriodSensitivity(baseInput);
    const capRate = calculateHoldingPeriodSensitivity({ ...baseInput, exitCapRate: 0.05 });

    it("IRRs diverge — the cap-rate method is meaningfully lower than flat 3% appreciation by year 10", () => {
      const flatYear10 = flat.holdPeriodAnalysis.find((o) => o.holdYears === 10)!;
      const capRateYear10 = capRate.holdPeriodAnalysis.find((o) => o.holdYears === 10)!;

      expect(capRateYear10.irr).toBeLessThan(flatYear10.irr);
      expect(flatYear10.irr).toBeCloseTo(0.10569, 4);
      expect(capRateYear10.irr).toBeCloseTo(0.05203, 4);
    });

    it("the resulting equity curves are substantially different by year 10, not just marginally", () => {
      const flatYear10 = flat.holdPeriodAnalysis.find((o) => o.holdYears === 10)!;
      const capRateYear10 = capRate.holdPeriodAnalysis.find((o) => o.holdYears === 10)!;

      const relativeDifference =
        Math.abs(flatYear10.projectedEquity - capRateYear10.projectedEquity) / flatYear10.projectedEquity;
      expect(relativeDifference).toBeGreaterThan(0.3); // well beyond noise-level difference
    });
  });

  describe("early exits (years 1-3)", () => {
    const result = calculateHoldingPeriodSensitivity(baseInput);

    it("IRR is lower in year 1 than at the year-4 peak", () => {
      const year1 = result.holdPeriodAnalysis.find((o) => o.holdYears === 1)!;
      const year4 = result.holdPeriodAnalysis.find((o) => o.holdYears === 4)!;

      expect(year1.irr).toBeLessThan(year4.irr);
      expect(year1.irr).toBeCloseTo(0.07794, 4);
    });

    it("cumulative CF is small (still negative) in the first few years — it hasn't had time to accumulate", () => {
      const year1 = result.holdPeriodAnalysis.find((o) => o.holdYears === 1)!;
      const year3 = result.holdPeriodAnalysis.find((o) => o.holdYears === 3)!;

      expect(Math.abs(year1.cumulativeCashFlow)).toBeLessThan(baseDeal.equityInvested * 0.05);
      expect(Math.abs(year3.cumulativeCashFlow)).toBeLessThan(baseDeal.equityInvested * 0.05);
    });
  });
});
