import { projectCashFlows } from "../src/cashflow";
import { buildInvestmentCashFlowSeries, calculateIRR } from "../src/returns";
import { rollupPortfolio, poolPortfolioCashFlows } from "../src/portfolio";

describe("rollupPortfolio", () => {
  // Three properties with different hold periods (5yr / 3yr / 4yr) and
  // different equity amounts, each built from the real cashflow.ts +
  // returns.ts engines.

  // Property A: 5-year hold (same golden case as tests/returns.test.ts)
  const aCashFlows = projectCashFlows({
    holdPeriodYears: 5,
    grossAnnualRent: 120000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 40000,
    rentGrowthRate: 0.03,
    expenseGrowthRate: 0.02,
    annualDebtService: 55000,
  });
  const aSeries = buildInvestmentCashFlowSeries(300000, aCashFlows, 400000);

  // Property B: 3-year hold
  const bCashFlows = projectCashFlows({
    holdPeriodYears: 3,
    grossAnnualRent: 80000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 25000,
    rentGrowthRate: 0.02,
    expenseGrowthRate: 0.03,
    annualDebtService: 32000,
  });
  const bSeries = buildInvestmentCashFlowSeries(150000, bCashFlows, 220000);

  // Property C: 4-year hold
  const cCashFlows = projectCashFlows({
    holdPeriodYears: 4,
    grossAnnualRent: 100000,
    vacancyRatePercent: 0.06,
    annualOperatingExpenses: 35000,
    rentGrowthRate: 0.025,
    expenseGrowthRate: 0.02,
    annualDebtService: 40000,
  });
  const cSeries = buildInvestmentCashFlowSeries(250000, cCashFlows, 300000);

  const properties = [
    {
      name: "Property A",
      equityInvested: 300000,
      cashFlowSeries: aSeries,
      annualNetCashFlow: aCashFlows[0].netCashFlow,
      dscr: 1.35,
      propertyValue: 1000000,
    },
    {
      name: "Property B",
      equityInvested: 150000,
      cashFlowSeries: bSeries,
      annualNetCashFlow: bCashFlows[0].netCashFlow,
      dscr: 1.15,
      propertyValue: 600000,
    },
    {
      name: "Property C",
      equityInvested: 250000,
      cashFlowSeries: cSeries,
      annualNetCashFlow: cCashFlows[0].netCashFlow,
      dscr: 1.5,
      propertyValue: 800000,
    },
  ];

  const result = rollupPortfolio(properties);

  it("pools cash flows period-by-period, treating a shorter hold's missing years as zero", () => {
    const pooled = poolPortfolioCashFlows(properties);

    // Longest series (Property A) is 6 entries (years 0-5); B and C are
    // padded with implicit zero contribution beyond their own hold period.
    expect(pooled).toHaveLength(6);

    // Year 0: -300,000 + -150,000 + -250,000
    expect(pooled[0]).toBeCloseTo(-700000, 2);
    // Year 1: 19,000 + 19,000 + 19,000
    expect(pooled[1]).toBeCloseTo(57000, 2);
    // Year 2: 21,620 + 19,770 + 20,650
    expect(pooled[2]).toBeCloseTo(62040, 2);
    // Year 3: 24,326.60 + (19,770 net CF + 220,000 exit = 240,547.90) + 22,344.75
    expect(pooled[3]).toBeCloseTo(287219.25, 2);
    // Year 4: 27,122.56 + 0 (B already exited) + (22,344.75 net CF... wait, C's exit lands here)
    expect(pooled[4]).toBeCloseTo(351207.9975, 2);
    // Year 5: only Property A remains (30,010.72 net CF + 400,000 exit)
    expect(pooled[5]).toBeCloseTo(430010.71794, 2);
  });

  it("computes the true pooled portfolio IRR from the combined cash flow series, matching an independent hand calculation", () => {
    // Independently verified: IRR of the pooled series
    // [-700000, 57000, 62040, 287219.25, 351207.9975, 430010.71794] ≈ 14.997%
    expect(result.pooledPortfolioIRR).toBeCloseTo(0.14997, 4);
  });

  it("keeps each property's own individual IRR available for display, separate from the pooled figure", () => {
    const irrA = calculateIRR(aSeries);
    const irrB = calculateIRR(bSeries);
    const irrC = calculateIRR(cSeries);

    expect(result.propertyIRRs).toEqual([
      { name: "Property A", individualIRR: expect.closeTo(irrA, 8) },
      { name: "Property B", individualIRR: expect.closeTo(irrB, 8) },
      { name: "Property C", individualIRR: expect.closeTo(irrC, 8) },
    ]);

    // Sanity check against independently computed golden values.
    expect(irrA).toBeCloseTo(0.13054, 4);
    expect(irrB).toBeCloseTo(0.2531, 4);
    expect(irrC).toBeCloseTo(0.12652, 4);
  });

  it("proves a naive equity-weighted average of individual IRRs is NOT the same as (and is wrong relative to) the true pooled IRR", () => {
    const totalEquity = properties.reduce((sum, p) => sum + p.equityInvested, 0);

    const naiveWeightedAverageIRR = result.propertyIRRs.reduce((sum, p, i) => {
      const equityShare = properties[i].equityInvested / totalEquity;
      return sum + p.individualIRR * equityShare;
    }, 0);

    // Naive weighted average ≈ 15.54%, true pooled IRR ≈ 15.00% — different,
    // and the naive method is the wrong one.
    expect(naiveWeightedAverageIRR).toBeCloseTo(0.15537, 4);
    expect(naiveWeightedAverageIRR).not.toBeCloseTo(result.pooledPortfolioIRR, 3);
  });

  it("sums total equity invested across all properties", () => {
    expect(result.totalEquityInvested).toBeCloseTo(700000, 2);
  });

  it("sums total annual net cash flow (year 1) across all properties", () => {
    // 19,000 + 19,000 + 19,000
    expect(result.totalAnnualNetCashFlow).toBeCloseTo(57000, 2);
  });

  it("takes the DSCR floor as the weakest-covered property (Property B at 1.15)", () => {
    expect(result.portfolioDSCRFloor).toBeCloseTo(1.15, 4);
  });

  it("computes each property's concentration as a percent of total portfolio value", () => {
    // Total value = 1,000,000 + 600,000 + 800,000 = 2,400,000
    expect(result.totalPortfolioValue).toBeCloseTo(2400000, 2);

    const [a, b, c] = result.concentrationRisk;
    expect(a.percentOfPortfolio).toBeCloseTo(0.41667, 4);
    expect(b.percentOfPortfolio).toBeCloseTo(0.25, 4);
    expect(c.percentOfPortfolio).toBeCloseTo(0.33333, 4);

    const total = a.percentOfPortfolio + b.percentOfPortfolio + c.percentOfPortfolio;
    expect(total).toBeCloseTo(1, 4);
  });
});
