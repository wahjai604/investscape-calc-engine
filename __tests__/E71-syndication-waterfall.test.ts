/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateSyndicationWaterfall } from "../src/E71-syndication-waterfall";
import { WaterfallTier } from "../src/types";

const DEFAULT_TEST_TIERS: WaterfallTier[] = [
  { irrHurdle: 0.08, lpSplit: 1.0, gpSplit: 0.0 },
  { irrHurdle: 0.12, lpSplit: 0.8, gpSplit: 0.2 },
  { irrHurdle: 0.15, lpSplit: 0.7, gpSplit: 0.3 },
  { irrHurdle: Infinity, lpSplit: 0.5, gpSplit: 0.5 },
];

describe("calculateSyndicationWaterfall", () => {
  describe("Compounding vs. simple preferred return", () => {
    it("compounds unpaid preferred return so it visibly diverges from what simple interest would give", () => {
      // $1000 capital, 10% preferred, three periods with zero distributions,
      // then a fourth period pays everything off.
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        preferredReturnRate: 0.1,
        gpCatchUpPercent: 0.2,
        tiers: DEFAULT_TEST_TIERS,
        cashFlows: [
          { period: 1, distributableCash: 0 },
          { period: 2, distributableCash: 0 },
          { period: 3, distributableCash: 0 },
          { period: 4, distributableCash: 10000 },
        ],
      });

      const period4 = result.distributions[3];
      // Compounding: 1000 * (1.1)^4 - 1000 = 464.10
      const compoundPreferredOwed = 1000 * Math.pow(1.1, 4) - 1000;
      // What simple interest (10% of the original $1000 each period, no compounding on unpaid amounts) would give instead:
      const simpleInterestPreferredOwed = 1000 * 0.1 * 4;

      expect(period4.preferredReturnPaid).toBeCloseTo(compoundPreferredOwed, 6);
      expect(period4.preferredReturnPaid).toBeCloseTo(464.1, 2);
      expect(period4.preferredReturnPaid).not.toBeCloseTo(simpleInterestPreferredOwed, 2);
      expect(period4.preferredReturnPaid).toBeGreaterThan(simpleInterestPreferredOwed);
    });
  });

  describe("GP catch-up wired correctly into the full waterfall (grossed-up, not flat)", () => {
    it("pays a grossed-up catch-up, not a flat percentage of preferred, once capital and preferred are fully satisfied", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        preferredReturnRate: 0.1,
        gpCatchUpPercent: 0.2,
        tiers: DEFAULT_TEST_TIERS,
        cashFlows: [
          { period: 1, distributableCash: 0 },
          { period: 2, distributableCash: 0 },
          { period: 3, distributableCash: 0 },
          { period: 4, distributableCash: 10000 },
        ],
      });

      const period4 = result.distributions[3];
      const cumulativePreferredPaid = period4.preferredReturnPaid; // all paid in this one period
      const grossedUpTarget = (cumulativePreferredPaid / (1 - 0.2)) * 0.2;
      const wrongFlatAnswer = cumulativePreferredPaid * 0.2;

      expect(period4.gpCatchUpPaid).toBeCloseTo(grossedUpTarget, 6);
      expect(period4.gpCatchUpPaid).not.toBeCloseTo(wrongFlatAnswer, 2);

      // Self-consistency: once fully caught up, GP's blended share of the whole
      // (preferred + catch-up) pool should land exactly on gpCatchUpPercent.
      expect(result.gpEffectivePromotePercent).toBeCloseTo(0.2, 6);
    });
  });

  describe("Insufficient cash — shortfall carries forward and keeps compounding", () => {
    it("pays a partial preferred amount when cash is short, and the carried-forward shortfall keeps compounding rather than staying flat", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        preferredReturnRate: 0.08,
        gpCatchUpPercent: 0.2,
        tiers: DEFAULT_TEST_TIERS,
        cashFlows: [
          { period: 1, distributableCash: 1000 }, // exactly covers capital, nothing left for preferred
          { period: 2, distributableCash: 40 }, // far short of the $80 preferred owed
          { period: 3, distributableCash: 1000 }, // plenty — pays off the carried-forward balance
        ],
      });

      const [period1, period2, period3] = result.distributions;

      expect(period1.returnOfCapital).toBeCloseTo(1000, 6);
      expect(period1.preferredReturnPaid).toBe(0);

      // $80 owed (1000 * 8%), only $40 available — not silently dropped, not silently capped-and-forgotten.
      expect(period2.preferredReturnPaid).toBeCloseTo(40, 6);

      // Unpaid $40 shortfall compounds again at 8% before period 3: 40 * 1.08 = 43.2,
      // plus period 3's own fresh 8% accrual on that already-compounded balance.
      // Full chain: (1000-1000)+80 owed after p1 -> p1 pays 0 -> 80 owed into p2 ->
      // p2 accrual: 80*1.08=86.4 owed -> pays 40 -> 46.4 carries forward ->
      // p3 accrual: 46.4*1.08=50.112 owed -> fully paid.
      expect(period3.preferredReturnPaid).toBeCloseTo(50.112, 3);
      // Not the naive (non-compounding) carry-forward of exactly $46.40.
      expect(period3.preferredReturnPaid).not.toBeCloseTo(46.4, 2);

      expect(result.issues).toEqual([]); // fully caught up by the end — no outstanding-balance issue
    });
  });

  describe("Multiple LPs with different contribution amounts", () => {
    it("allocates return of capital pro-rata by contribution size, not evenly across LPs", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000000,
        lpContributions: [
          { investorId: "A", amount: 700000 },
          { investorId: "B", amount: 300000 },
        ],
        cashFlows: [{ period: 1, distributableCash: 1000000 }],
      });

      const [period1] = result.distributions;
      const [lpA, lpB] = period1.lpBreakdown;

      expect(lpA.investorId).toBe("A");
      expect(lpA.returnOfCapital).toBeCloseTo(700000, 2); // 70% of contributions
      expect(lpB.returnOfCapital).toBeCloseTo(300000, 2); // 30% of contributions

      // Explicitly not an even 50/50 split.
      expect(lpA.returnOfCapital).not.toBeCloseTo(lpB.returnOfCapital, 0);
      expect(lpA.returnOfCapital + lpB.returnOfCapital).toBeCloseTo(period1.returnOfCapital, 2);
    });
  });

  describe("Tier splits not summing to 1.0", () => {
    it("normalizes a malformed tier's split, reports a typed issue, and still allocates the full period's cash", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        preferredReturnRate: 0, // isolate tier-selection behavior from preferred/catch-up math
        gpCatchUpPercent: 0.2,
        tiers: [
          { irrHurdle: 0.08, lpSplit: 1.0, gpSplit: 0.0 },
          { irrHurdle: Infinity, lpSplit: 0.9, gpSplit: 0.2 }, // sums to 1.1 -- malformed
        ],
        cashFlows: [
          { period: 1, distributableCash: 1000 },
          { period: 2, distributableCash: 1000 },
          { period: 3, distributableCash: 1000 }, // pushes achieved IRR into the malformed top tier
        ],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("splits sum to 1.1")])
      );

      const period3 = result.distributions[2];
      const split = period3.tierSplitAmounts[0];
      expect(split.tierIndex).toBe(1);
      // Normalized: 0.9/1.1 and 0.2/1.1
      expect(split.lpAmount / (split.lpAmount + split.gpAmount)).toBeCloseTo(0.9 / 1.1, 6);
      // No cash created or destroyed by the malformed input.
      expect(split.lpAmount + split.gpAmount).toBeCloseTo(1000, 6);
    });
  });

  describe("Tier selection edge cases", () => {
    it("falls back to the first (most conservative) tier when achieved IRR can't be computed yet", () => {
      // Zero capital and zero preferred rate mean every period's LP cash
      // flow (pre-tier-4) is exactly $0 -- no sign change for Newton-Raphson
      // to find a root against, so calculateIRR returns NaN.
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 0,
        lpContributions: [{ investorId: "A", amount: 0 }],
        preferredReturnRate: 0,
        tiers: DEFAULT_TEST_TIERS,
        cashFlows: [{ period: 1, distributableCash: 500 }],
      });

      expect(result.distributions[0].tierSplitAmounts[0].tierIndex).toBe(0);
      expect(result.distributions[0].lpTotal).toBeCloseTo(500, 6); // tier 0 is 100% LP
    });

    it("falls back to the highest tier when achieved IRR exceeds every finite hurdle in the table", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 100,
        lpContributions: [{ investorId: "A", amount: 100 }],
        preferredReturnRate: 0,
        tiers: [
          { irrHurdle: 0.05, lpSplit: 1.0, gpSplit: 0.0 },
          { irrHurdle: 0.1, lpSplit: 0.6, gpSplit: 0.4 },
        ], // no Infinity sentinel -- both hurdles are finite
        cashFlows: [
          { period: 1, distributableCash: 100 }, // just return of capital
          { period: 2, distributableCash: 1000 }, // builds up cumulative distributions at the low tier
          { period: 3, distributableCash: 1000 }, // now achieved IRR blows past both hurdles
        ],
      });

      const period3 = result.distributions[2];
      expect(period3.tierSplitAmounts[0].tierIndex).toBe(1); // falls back to the last (highest) tier, not out of bounds
    });
  });

  describe("Zero / negative distributable cash", () => {
    it("makes no distribution and raises no error for a zero or negative cash period; unpaid preferred carries forward", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        preferredReturnRate: 0.08,
        cashFlows: [
          { period: 1, distributableCash: -500 },
          { period: 2, distributableCash: 0 },
        ],
      });

      expect(result.distributions[0]).toMatchObject({
        returnOfCapital: 0,
        preferredReturnPaid: 0,
        gpCatchUpPaid: 0,
        lpTotal: 0,
        gpTotal: 0,
      });
      expect(result.distributions[1]).toMatchObject({
        returnOfCapital: 0,
        preferredReturnPaid: 0,
      });

      // Capital and two periods of accrued (compounding) preferred remain unpaid, and it's reported, not silently dropped.
      expect(result.issues.some((issue) => issue.includes("remain unpaid"))).toBe(true);
    });
  });

  describe("Defaults", () => {
    it("falls back to DEFAULT_PREFERRED_RETURN_RATE, DEFAULT_GP_CATCHUP_PERCENT, and DEFAULT_WATERFALL_TIERS when omitted", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 1000,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        cashFlows: [{ period: 1, distributableCash: 100 }],
      });

      // No throw from missing tiers/rate/gpCatchUpPercent, and the default
      // 8% preferred rate is what accrues (verified via the outstanding-
      // balance issue, since only $100 of $1000 capital was returned here).
      expect(result.distributions[0].returnOfCapital).toBeCloseTo(100, 6);
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("$900.00 of capital")])
      );
    });
  });

  describe("totalEquityRaised consistency", () => {
    it("flags a mismatch against the sum of lpContributions but still computes using the contribution sum", () => {
      const result = calculateSyndicationWaterfall({
        totalEquityRaised: 999,
        lpContributions: [{ investorId: "A", amount: 1000 }],
        cashFlows: [{ period: 1, distributableCash: 100 }],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("does not match the sum of lpContributions")])
      );
      expect(result.distributions[0].returnOfCapital).toBeCloseTo(100, 6); // used the $1000 sum, not $999
    });
  });
});
