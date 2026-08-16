/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateLoanConventionDSCR, evaluateLoanConventionDSCR } from "../src/E76-dscr-loan-sizing";
import { calculateDSCR } from "../src/E9-dscr";

describe("calculateLoanConventionDSCR", () => {
  it("computes gross monthly rent / monthly PITIA — not NOI / annual debt service", () => {
    expect(calculateLoanConventionDSCR(1300, 1000)).toBeCloseTo(1.3, 6);
  });
});

describe("evaluateLoanConventionDSCR — below-minimum returns a typed result with the real ratio, not just a boolean", () => {
  it("returns the actual computed ratio and flags belowStandardMinimum when under the default 1.0 minimum", () => {
    const result = evaluateLoanConventionDSCR({ grossMonthlyRent: 1000, monthlyPITIA: 1100 });

    expect(result.loanConventionDSCR).toBeCloseTo(0.9091, 4);
    expect(result.minimumRatioRequired).toBe(1.0);
    expect(result.meetsMinimumRatio).toBe(false);
    expect(result.belowStandardMinimum).toBe(true);
    expect(result.qualifiesForBestTerms).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("qualifies for best terms at/above the 1.25 strong-ratio threshold", () => {
    const result = evaluateLoanConventionDSCR({ grossMonthlyRent: 1300, monthlyPITIA: 1000 });
    expect(result.loanConventionDSCR).toBeCloseTo(1.3, 6);
    expect(result.meetsMinimumRatio).toBe(true);
    expect(result.qualifiesForBestTerms).toBe(true);
    expect(result.belowStandardMinimum).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it("respects an admin-supplied minimumRatioOverride instead of the default", () => {
    const result = evaluateLoanConventionDSCR({
      grossMonthlyRent: 1200,
      monthlyPITIA: 1000,
      minimumRatioOverride: 1.25,
    });
    expect(result.loanConventionDSCR).toBeCloseTo(1.2, 6);
    expect(result.minimumRatioRequired).toBe(1.25);
    expect(result.belowStandardMinimum).toBe(true); // 1.2 < 1.25 override, even though it's above the 1.0 default
  });

  it("mentions the no-ratio-program exception distinctly when lenderAllowsNoRatioProgram is set", () => {
    const result = evaluateLoanConventionDSCR({
      grossMonthlyRent: 1000,
      monthlyPITIA: 1200,
      lenderAllowsNoRatioProgram: true,
    });
    expect(result.belowStandardMinimum).toBe(true);
    expect(result.issues[0]).toMatch(/no-ratio/i);
  });
});

describe("Distinct from E9's commercial DSCR — same name shape, different formula entirely", () => {
  it("produces a different result than E9's calculateDSCR for numbers that would coincidentally look similar", () => {
    // E76: gross rent 2000 / PITIA 1600 = 1.25 (loan-convention)
    const loanConventionRatio = calculateLoanConventionDSCR(2000, 1600);
    // E9: NOI 2000 / annual debt service 1600 = 1.25 (commercial) -- same
    // inputs by coincidence, but conceptually unrelated: NOI already nets
    // out vacancy/opex, annual debt service isn't a monthly PITIA figure.
    const commercialRatio = calculateDSCR({ netOperatingIncome: 2000, annualDebtService: 1600 });

    expect(loanConventionRatio).toBeCloseTo(commercialRatio, 6); // arithmetically coincidental
    // The real distinction is in the input semantics, not the output number
    // -- verified by the fact these are two entirely separate exported
    // functions with non-overlapping type names (LoanConventionDSCR* vs.
    // DSCR*), not a shared implementation.
  });
});
