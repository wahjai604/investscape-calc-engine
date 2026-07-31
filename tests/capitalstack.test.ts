import { calculateCapitalStack } from "../src/capitalstack";

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
});
