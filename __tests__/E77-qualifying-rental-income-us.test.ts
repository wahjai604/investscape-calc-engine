/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateQualifyingRentalIncomeUS } from "../src/E77-qualifying-rental-income-us";

describe("calculateQualifyingRentalIncomeUS", () => {
  it("applies the 75% haircut to gross monthly rent when a signed lease exists", () => {
    const result = calculateQualifyingRentalIncomeUS({ grossMonthlyRent: 2000, hasSignedLease: true });

    expect(result.qualifyingRentalIncome).toBeCloseTo(1500, 2);
    expect(result.haircutApplied).toBe(0.75);
    expect(result.methodology).toBe("lease_based_75_percent");
    expect(result.applied).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("refuses to apply the rule without a signed lease -- null income, not a market-rent fallback", () => {
    const result = calculateQualifyingRentalIncomeUS({ grossMonthlyRent: 2000, hasSignedLease: false });

    expect(result.qualifyingRentalIncome).toBeNull();
    expect(result.applied).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("No signed lease on file")])
    );
  });

  it("the refusal issue explicitly names the Phase 2 Schedule E path as unavailable, not silently omitted", () => {
    const result = calculateQualifyingRentalIncomeUS({ grossMonthlyRent: 3000, hasSignedLease: false });
    expect(result.issues[0]).toMatch(/schedule e/i);
    expect(result.issues[0]).toMatch(/phase 2/i);
  });
});
