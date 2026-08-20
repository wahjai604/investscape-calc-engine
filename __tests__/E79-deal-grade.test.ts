/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateDealGrade } from "../src/E79-deal-grade";
import { DealGradeInput } from "../src/types";

// Representative values landing in each of the four scoring tiers, per
// metric, per E79-deal-grade.ts's thresholds (utils/constants.ts):
// strong=25, solid=15, weak=5, fail=0.
const capRateByTier = { strong: 0.09, solid: 0.07, weak: 0.05, fail: 0.02 };
const cashOnCashByTier = { strong: 0.11, solid: 0.08, weak: 0.04, fail: -0.03 };
const dscrByTier = { strong: 1.6, solid: 1.3, weak: 1.05, fail: 0.9 };
const irrByTier = { strong: 0.2, solid: 0.15, weak: 0.1, fail: 0.05 };

type Tier = "strong" | "solid" | "weak" | "fail";

function dealAt(capRate: Tier, cashOnCash: Tier, dscr: Tier, irr: Tier): DealGradeInput {
  return {
    capRate: capRateByTier[capRate],
    cashOnCash: cashOnCashByTier[cashOnCash],
    dscr: dscrByTier[dscr],
    irr: irrByTier[irr],
  };
}

describe("calculateDealGrade", () => {
  it("grades a strong deal (all four metrics in the top tier) as A with a 100 overall score", () => {
    const result = calculateDealGrade(dealAt("strong", "strong", "strong", "strong"));

    expect(result.overallScore).toBeCloseTo(100, 6);
    expect(result.grade).toBe("A");
    expect(result.fullyScored).toBe(true);
    expect(result.flaggedIssues).toHaveLength(0);
  });

  it("grades a weak deal (all four metrics failing — including negative cash flow and DSCR < 1.0) as C with a 0 overall score", () => {
    const result = calculateDealGrade(dealAt("fail", "fail", "fail", "fail"));

    expect(result.overallScore).toBeCloseTo(0, 6);
    expect(result.grade).toBe("C");
    expect(result.flaggedIssues.some((s) => s.includes("Negative cash flow"))).toBe(true);
    expect(result.flaggedIssues.some((s) => s.includes("DSCR below 1.0"))).toBe(true);
  });

  it("flags negative cash flow specifically, distinct from a merely weak cash-on-cash figure", () => {
    const result = calculateDealGrade(dealAt("strong", "fail", "strong", "strong"));
    expect(result.scoreBreakdown.cashOnCash.score).toBe(0);
    expect(result.flaggedIssues.some((s) => s.includes("Negative cash flow"))).toBe(true);
  });

  it("flags DSCR below 1.0 specifically, distinct from a merely weak DSCR figure", () => {
    const result = calculateDealGrade(dealAt("strong", "strong", "fail", "strong"));
    expect(result.scoreBreakdown.dscr.score).toBe(0);
    expect(result.flaggedIssues.some((s) => s.includes("DSCR below 1.0"))).toBe(true);
  });

  it("returns a typed insufficient-data result for a metric with no comparable data, excluding it from overallScore rather than zero-weighting it", () => {
    // IRR unavailable (e.g. Property Detail with no modeled exit); the other
    // three are all strong, so overallScore should rescale to 100/100 over
    // 3 metrics, NOT (75/100) as it would if the missing IRR were scored 0.
    const result = calculateDealGrade({
      capRate: capRateByTier.strong,
      cashOnCash: cashOnCashByTier.strong,
      dscr: dscrByTier.strong,
      irr: null,
    });

    expect(result.scoreBreakdown.irr.score).toBeNull();
    expect(result.scoreBreakdown.irr.valueText).toBe("Insufficient data");
    expect(result.overallScore).toBeCloseTo(100, 6);
    expect(result.fullyScored).toBe(false);
    expect(result.flaggedIssues.some((s) => s.includes("IRR") && s.includes("insufficient data"))).toBe(true);
  });

  describe("A/B+/B/B-/C bracket boundaries", () => {
    // Per-metric scores only land on {0, 5, 15, 25}, so not every multiple
    // of 5 is a reachable overall score (85 and 95, for instance, are not).
    // Each pair below uses a real combination of tier assignments that
    // reaches the cutoff exactly, and the nearest reachable score just
    // under it.

    it("80 (two strong + two solid) grades A; 75 (three strong + one fail) grades B+", () => {
      const atCutoff = calculateDealGrade(dealAt("strong", "strong", "solid", "solid"));
      expect(atCutoff.overallScore).toBeCloseTo(80, 6);
      expect(atCutoff.grade).toBe("A");

      const justBelow = calculateDealGrade(dealAt("strong", "strong", "strong", "fail"));
      expect(justBelow.overallScore).toBeCloseTo(75, 6);
      expect(justBelow.grade).toBe("B+");
    });

    it("65 (two strong + one solid + one fail) grades B+; 60 (two strong + two weak) grades B", () => {
      const atCutoff = calculateDealGrade(dealAt("strong", "strong", "solid", "fail"));
      expect(atCutoff.overallScore).toBeCloseTo(65, 6);
      expect(atCutoff.grade).toBe("B+");

      const justBelow = calculateDealGrade(dealAt("strong", "strong", "weak", "weak"));
      expect(justBelow.overallScore).toBeCloseTo(60, 6);
      expect(justBelow.grade).toBe("B");
    });

    it("50 (two strong + two fail) grades B; 45 (one strong + one solid + one weak + one fail) grades B-", () => {
      const atCutoff = calculateDealGrade(dealAt("strong", "strong", "fail", "fail"));
      expect(atCutoff.overallScore).toBeCloseTo(50, 6);
      expect(atCutoff.grade).toBe("B");

      const justBelow = calculateDealGrade(dealAt("strong", "solid", "weak", "fail"));
      expect(justBelow.overallScore).toBeCloseTo(45, 6);
      expect(justBelow.grade).toBe("B-");
    });

    it("35 (one strong + two weak + one fail) grades B-; 30 (two solid + two fail) grades C", () => {
      const atCutoff = calculateDealGrade(dealAt("strong", "weak", "weak", "fail"));
      expect(atCutoff.overallScore).toBeCloseTo(35, 6);
      expect(atCutoff.grade).toBe("B-");

      const justBelow = calculateDealGrade(dealAt("solid", "solid", "fail", "fail"));
      expect(justBelow.overallScore).toBeCloseTo(30, 6);
      expect(justBelow.grade).toBe("C");
    });
  });
});
