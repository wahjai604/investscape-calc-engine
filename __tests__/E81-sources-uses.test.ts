/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateSourcesUses } from "../src/E81-sources-uses";
import { SourcesUsesInput, FinancingFacility } from "../src/types";

// A senior mortgage + sponsor equity, sized so uses exactly consume every
// dollar of sources: facility amount 6,000,000 (interestReserve 200,000 +
// commitmentFee 60,000 [1%] = 260,000 financing costs, netAdvance
// 5,740,000) + sponsor equity 2,500,000 = 8,500,000 total sources.
// Uses: land 3,000,000 + hard 4,000,000 + soft 900,000 + financing 260,000
// (derived from the facility) + contingency 340,000 = 8,500,000.
const senior: FinancingFacility = {
  id: "senior",
  type: "senior_debt",
  amount: 6000000,
  rate: 0.08,
  amortizationYears: 20,
  interestReserveAmount: 200000,
  commitmentFeePercent: 0.01,
};

describe("calculateSourcesUses", () => {
  it("a balanced deal: sources equal uses exactly, balanced is true, issues is empty", () => {
    const input: SourcesUsesInput = {
      facilities: [senior],
      sponsorEquityAmount: 2500000,
      uses: {
        landAcquisitionCost: 3000000,
        hardCosts: 4000000,
        softCosts: 900000,
        contingency: 340000,
        // financingCosts omitted — derived from `senior`: 200,000 + 60,000 = 260,000
      },
    };

    const result = calculateSourcesUses(input);

    expect(result.sources.total).toBeCloseTo(8500000, 2);
    expect(result.uses.financingCosts).toBeCloseTo(260000, 2);
    expect(result.uses.total).toBeCloseTo(8500000, 2);
    expect(result.delta).toBeCloseTo(0, 6);
    expect(result.balanced).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("an intentionally unbalanced deal: reports the real shortfall via delta/issues rather than hiding it", () => {
    const input: SourcesUsesInput = {
      facilities: [senior],
      sponsorEquityAmount: 2500000,
      uses: {
        landAcquisitionCost: 3000000,
        hardCosts: 4500000, // +500,000 vs. the balanced case
        softCosts: 900000,
        contingency: 340000,
      },
    };

    const result = calculateSourcesUses(input);

    expect(result.sources.total).toBeCloseTo(8500000, 2);
    expect(result.uses.total).toBeCloseTo(9000000, 2);
    expect(result.delta).toBeCloseTo(-500000, 2);
    expect(result.balanced).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("500000.00");
    expect(result.issues[0]).toContain("fall short of");
  });

  it("does not silently round or force-balance: a $1 mismatch (well outside the float-noise tolerance) is still reported", () => {
    const input: SourcesUsesInput = {
      facilities: [senior],
      sponsorEquityAmount: 2500001, // +$1
      uses: {
        landAcquisitionCost: 3000000,
        hardCosts: 4000000,
        softCosts: 900000,
        contingency: 340000,
      },
    };

    const result = calculateSourcesUses(input);
    expect(result.delta).toBeCloseTo(1, 6);
    expect(result.balanced).toBe(false);
    expect(result.issues[0]).toContain("exceed");
  });

  it("a mismatch within the float-noise tolerance is treated as balanced", () => {
    const input: SourcesUsesInput = {
      facilities: [senior],
      sponsorEquityAmount: 2500000.005,
      uses: {
        landAcquisitionCost: 3000000,
        hardCosts: 4000000,
        softCosts: 900000,
        contingency: 340000,
      },
    };

    const result = calculateSourcesUses(input);
    expect(result.balanced).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("explicit uses.financingCosts overrides the derived-from-facilities figure (the flagged integration point when no facilities are wired up yet)", () => {
    const input: SourcesUsesInput = {
      facilities: [],
      sponsorEquityAmount: 8500000,
      uses: {
        landAcquisitionCost: 3000000,
        hardCosts: 4000000,
        softCosts: 900000,
        contingency: 340000,
        financingCosts: 260000,
      },
    };

    const result = calculateSourcesUses(input);
    expect(result.sources.facilities).toHaveLength(0);
    expect(result.uses.financingCosts).toBe(260000);
    expect(result.sources.total).toBeCloseTo(8500000, 2);
    expect(result.uses.total).toBeCloseTo(8500000, 2);
    expect(result.balanced).toBe(true);
  });
});
