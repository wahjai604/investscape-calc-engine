import { projectCashFlows } from "../src/cashflow";

describe("projectCashFlows", () => {
  // Golden values computed independently: rent compounds at 3%/yr off
  // $120,000, opex compounds at 2%/yr off $40,000, vacancy is a constant 5%
  // of that year's grown rent, and debt service is held flat at $55,000/yr.
  const projection = projectCashFlows({
    holdPeriodYears: 5,
    grossAnnualRent: 120000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 40000,
    rentGrowthRate: 0.03,
    expenseGrowthRate: 0.02,
    annualDebtService: 55000,
  });

  it("produces one row per year of the hold period", () => {
    expect(projection).toHaveLength(5);
    expect(projection.map((row) => row.year)).toEqual([1, 2, 3, 4, 5]);
  });

  it("matches the golden figures for year 1 (no growth applied yet)", () => {
    const [year1] = projection;

    expect(year1.grossRent).toBeCloseTo(120000, 2);
    expect(year1.vacancyAllowance).toBeCloseTo(6000, 2);
    expect(year1.operatingExpenses).toBeCloseTo(40000, 2);
    expect(year1.noi).toBeCloseTo(74000, 2);
    expect(year1.debtService).toBeCloseTo(55000, 2);
    expect(year1.netCashFlow).toBeCloseTo(19000, 2);
  });

  it("matches the golden figures for year 3 (rent and opex compounded twice)", () => {
    const year3 = projection[2];

    expect(year3.grossRent).toBeCloseTo(127308, 2);
    expect(year3.vacancyAllowance).toBeCloseTo(6365.4, 2);
    expect(year3.operatingExpenses).toBeCloseTo(41616, 2);
    expect(year3.noi).toBeCloseTo(79326.6, 2);
    expect(year3.debtService).toBeCloseTo(55000, 2);
    expect(year3.netCashFlow).toBeCloseTo(24326.6, 2);
  });

  it("matches the golden figures for year 5, the final year of the hold", () => {
    const year5 = projection[4];

    expect(year5.grossRent).toBeCloseTo(135061.06, 2);
    expect(year5.vacancyAllowance).toBeCloseTo(6753.05, 2);
    expect(year5.operatingExpenses).toBeCloseTo(43297.29, 2);
    expect(year5.noi).toBeCloseTo(85010.72, 2);
    expect(year5.debtService).toBeCloseTo(55000, 2);
    expect(year5.netCashFlow).toBeCloseTo(30010.72, 2);
  });

  it("grows net cash flow monotonically since rent growth outpaces expense growth on a flat debt service", () => {
    for (let i = 1; i < projection.length; i++) {
      expect(projection[i].netCashFlow).toBeGreaterThan(projection[i - 1].netCashFlow);
    }
  });
});
