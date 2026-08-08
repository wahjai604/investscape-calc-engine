/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateCapitalStack } from "../src/E8-capitalstack";

describe("calculateCapitalStack", () => {
  // Golden values independently hand-verified against direct arithmetic
  // — see Doc 54 Step 2 reconciliation.

  it("computes interest cost, total debt service, and blended cost of capital for a two-tranche deal", () => {
    // $700k senior debt @ 6% + $300k equity @ 15% target return
    const result = calculateCapitalStack([
      { type: "senior_debt", amount: 700000, rate: 0.06 },
      { type: "equity", amount: 300000, rate: 0.15 },
    ]);

    expect(result.totalCapital).toBeCloseTo(1000000, 2);

    const [senior, equity] = result.tranches;
    expect(senior.interestCost).toBeCloseTo(42000, 2);
    expect(senior.capitalWeight).toBeCloseTo(0.7, 4);
    expect(equity.interestCost).toBeCloseTo(45000, 2);
    expect(equity.capitalWeight).toBeCloseTo(0.3, 4);

    // Only senior debt counts toward debt service; equity has no fixed payment
    expect(result.totalDebtService).toBeCloseTo(42000, 2);

    // 6% * 0.7 + 15% * 0.3 = 8.7%
    expect(result.weightedAverageCost).toBeCloseTo(0.087, 4);
  });

  it("computes interest cost, total debt service, and blended cost of capital for a three-tranche deal", () => {
    // $600k senior debt @ 5.5% + $150k mezzanine @ 10% + $250k equity @ 18%
    const result = calculateCapitalStack([
      { type: "senior_debt", amount: 600000, rate: 0.055 },
      { type: "mezzanine", amount: 150000, rate: 0.1 },
      { type: "equity", amount: 250000, rate: 0.18 },
    ]);

    expect(result.totalCapital).toBeCloseTo(1000000, 2);

    const [senior, mezz, equity] = result.tranches;
    expect(senior.interestCost).toBeCloseTo(33000, 2);
    expect(senior.capitalWeight).toBeCloseTo(0.6, 4);
    expect(mezz.interestCost).toBeCloseTo(15000, 2);
    expect(mezz.capitalWeight).toBeCloseTo(0.15, 4);
    expect(equity.interestCost).toBeCloseTo(45000, 2);
    expect(equity.capitalWeight).toBeCloseTo(0.25, 4);

    // Senior + mezzanine debt service, equity excluded
    expect(result.totalDebtService).toBeCloseTo(48000, 2);

    // 5.5% * 0.6 + 10% * 0.15 + 18% * 0.25 = 9.3%
    expect(result.weightedAverageCost).toBeCloseTo(0.093, 4);
  });

  it("wacc is null when no taxRate is supplied, while weightedAverageCost is still computed", () => {
    const result = calculateCapitalStack([
      { type: "senior_debt", amount: 700000, rate: 0.06 },
      { type: "equity", amount: 300000, rate: 0.15 },
    ]);

    expect(result.wacc).toBeNull();
    expect(result.weightedAverageCost).toBeCloseTo(0.087, 4);
  });

  it("applies the (1 - Tc) interest tax shield to debt tranches only, for a true WACC (two-tranche deal)", () => {
    // $700k senior debt @ 6% + $300k equity @ 15%, 25% corporate tax rate.
    // After-tax senior cost: 6% * (1 - 0.25) = 4.5%. Equity is unaffected (no tax deduction on distributions).
    // WACC = 0.7 * 4.5% + 0.3 * 15% = 3.15% + 4.5% = 7.65%
    const result = calculateCapitalStack(
      [
        { type: "senior_debt", amount: 700000, rate: 0.06 },
        { type: "equity", amount: 300000, rate: 0.15 },
      ],
      0.25,
    );

    expect(result.wacc).toBeCloseTo(0.0765, 4);
    // weightedAverageCost stays the untaxed figure regardless of taxRate being supplied.
    expect(result.weightedAverageCost).toBeCloseTo(0.087, 4);
  });

  it("applies the tax shield to every debt tranche (senior + mezzanine), not just senior debt (three-tranche deal)", () => {
    // $600k senior @ 5.5% + $150k mezzanine @ 10% + $250k equity @ 18%, 25% tax rate.
    // After-tax senior: 5.5% * 0.75 = 4.125%, weighted = 0.6 * 4.125% = 2.475%
    // After-tax mezzanine: 10% * 0.75 = 7.5%, weighted = 0.15 * 7.5% = 1.125%
    // Equity (untaxed): weighted = 0.25 * 18% = 4.5%
    // WACC = 2.475% + 1.125% + 4.5% = 8.1%
    const result = calculateCapitalStack(
      [
        { type: "senior_debt", amount: 600000, rate: 0.055 },
        { type: "mezzanine", amount: 150000, rate: 0.1 },
        { type: "equity", amount: 250000, rate: 0.18 },
      ],
      0.25,
    );

    expect(result.wacc).toBeCloseTo(0.081, 4);
  });

  it("at a 0% tax rate, wacc converges exactly to weightedAverageCost (no shield benefit)", () => {
    const result = calculateCapitalStack(
      [
        { type: "senior_debt", amount: 600000, rate: 0.055 },
        { type: "mezzanine", amount: 150000, rate: 0.1 },
        { type: "equity", amount: 250000, rate: 0.18 },
      ],
      0,
    );

    expect(result.wacc).toBeCloseTo(result.weightedAverageCost, 10);
  });

  it("an all-equity stack is unaffected by taxRate, since equity gets no tax shield", () => {
    const withoutTax = calculateCapitalStack([{ type: "equity", amount: 500000, rate: 0.12 }]);
    const withTax = calculateCapitalStack([{ type: "equity", amount: 500000, rate: 0.12 }], 0.35);

    expect(withoutTax.weightedAverageCost).toBeCloseTo(0.12, 6);
    expect(withTax.wacc).toBeCloseTo(0.12, 6);
    expect(withTax.wacc).toBeCloseTo(withoutTax.weightedAverageCost, 6);
  });
});
