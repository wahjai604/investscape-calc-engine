import { projectCashFlows } from "../src/E3-cashflow";
import { buildInvestmentCashFlowSeries, calculateIRR, calculateMIRR, calculateEquityMultiple } from "../src/E5-returns";

describe("returns calculators for a 5-year hold", () => {
  // Cash flows come straight from the cashflow engine's golden 5-year
  // projection (see tests/cashflow.test.ts): $120,000 starting rent at 3%
  // growth, $40,000 opex at 2% growth, 5% vacancy, $55,000/yr debt service.
  //
  // Golden values independently hand-verified: equity multiple confirmed by
  // direct arithmetic, IRR confirmed by discounting the cash flow series at
  // the candidate rate and checking it nets to the initial outlay, MIRR
  // confirmed by compounding positive flows forward and discounting the
  // outlay back — see Doc 54 Step 2 reconciliation.
  const annualCashFlows = projectCashFlows({
    holdPeriodYears: 5,
    grossAnnualRent: 120000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 40000,
    rentGrowthRate: 0.03,
    expenseGrowthRate: 0.02,
    annualDebtService: 55000,
  });

  const equityInvested = 300000;
  const exitValue = 400000;

  const series = buildInvestmentCashFlowSeries(equityInvested, annualCashFlows, exitValue);

  it("builds the year 0-5 series with a negative outlay and the exit value folded into year 5", () => {
    expect(series).toHaveLength(6);
    expect(series[0]).toBeCloseTo(-300000, 2);
    expect(series[1]).toBeCloseTo(19000, 2);
    expect(series[2]).toBeCloseTo(21620, 2);
    expect(series[3]).toBeCloseTo(24326.6, 2);
    expect(series[4]).toBeCloseTo(27122.56, 2);
    // year 5 net cash flow (30,010.72) + exit value (400,000)
    expect(series[5]).toBeCloseTo(430010.72, 2);
  });

  it("matches the golden IRR", () => {
    const irr = calculateIRR(series);
    expect(irr).toBeCloseTo(0.1305, 4);
  });

  it("matches the golden MIRR at a 6% finance rate and 8% reinvestment rate", () => {
    const mirr = calculateMIRR(series, 0.06, 0.08);
    expect(mirr).toBeCloseTo(0.1251, 4);
  });

  it("matches the golden equity multiple", () => {
    const equityMultiple = calculateEquityMultiple(equityInvested, series);
    expect(equityMultiple).toBeCloseTo(1.7403, 4);
  });
});
