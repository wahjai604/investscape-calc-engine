import { projectCashFlows } from "../src/E3-cashflow";

describe("projectCashFlows", () => {
  // Golden values independently hand-verified year-by-year (years 1, 3, and 5
  // checked in full) against the stated compounding formula — see Doc 54
  // Step 2 reconciliation.
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

describe("projectCashFlows (E9 — real debt service via amortizationSchedule)", () => {
  // Same $706,000 / 4.79% / 25yr / Canada loan as the amortization.ts golden
  // test, whose month-60 balance ($622,781) was independently hand-verified
  // in Design. Expected debtService/interestPaid/principalPaid figures below
  // are derived independently here from the standard closed-form annuity
  // formulas (not by running the code under test):
  //   r = (1 + 0.0479/2)^(1/6) - 1
  //   payment = r*706000 / (1 - (1+r)^-300)  =>  4022.141037/mo
  //   balance(k) = 706000*(1+r)^k - payment*((1+r)^k - 1)/r
  // balance(60) computed this way = 622,781.27, matching the already
  // externally-confirmed figure — cross-checked before using this loan to
  // derive the year-by-year figures below.
  // Rent/expense/NOI figures reuse the flat-debt-service block's own
  // already-hand-verified NOI progression above (year1 NOI=74000,
  // year3 NOI=79326.6, year5 NOI=85010.72) — only the debt-service side is
  // new here.
  const realProjection = projectCashFlows({
    holdPeriodYears: 5,
    grossAnnualRent: 120000,
    vacancyRatePercent: 0.05,
    annualOperatingExpenses: 40000,
    rentGrowthRate: 0.03,
    expenseGrowthRate: 0.02,
    loan: {
      purchasePrice: 706000,
      downPaymentPercent: 0,
      annualInterestRate: 0.0479,
      amortizationYears: 25,
    },
    country: "Canada",
  });

  it("produces one row per year, each carrying the real interest/principal split", () => {
    expect(realProjection).toHaveLength(5);
    for (const row of realProjection) {
      expect(row.interestPaid).toBeDefined();
      expect(row.principalPaid).toBeDefined();
    }
  });

  it("year 1: debtService/interestPaid/principalPaid match the independently derived annuity figures", () => {
    const [year1] = realProjection;
    expect(year1.noi).toBeCloseTo(74000, 2);
    expect(year1.debtService).toBeCloseTo(48265.69, 2);
    expect(year1.interestPaid).toBeCloseTo(33159.21, 2);
    expect(year1.principalPaid).toBeCloseTo(15106.49, 2);
    expect(year1.netCashFlow).toBeCloseTo(74000 - 48265.69, 2);
  });

  it("year 3: debtService/interestPaid/principalPaid match the independently derived annuity figures", () => {
    const year3 = realProjection[2];
    expect(year3.noi).toBeCloseTo(79326.6, 2);
    expect(year3.debtService).toBeCloseTo(48265.69, 2);
    expect(year3.interestPaid).toBeCloseTo(31659.18, 2);
    expect(year3.principalPaid).toBeCloseTo(16606.51, 2);
    expect(year3.netCashFlow).toBeCloseTo(79326.6 - 48265.69, 2);
  });

  it("year 5: debtService/interestPaid/principalPaid match the independently derived annuity figures", () => {
    const year5 = realProjection[4];
    expect(year5.noi).toBeCloseTo(85010.72, 2);
    expect(year5.debtService).toBeCloseTo(48265.69, 2);
    expect(year5.interestPaid).toBeCloseTo(30010.2, 2);
    expect(year5.principalPaid).toBeCloseTo(18255.49, 2);
    expect(year5.netCashFlow).toBeCloseTo(85010.72 - 48265.69, 2);
  });

  it("debtService stays the full P&I payment (Doc 01 B6/B10), equal to interestPaid + principalPaid every year", () => {
    for (const row of realProjection) {
      expect(row.interestPaid! + row.principalPaid!).toBeCloseTo(row.debtService, 2);
    }
  });

  it("cumulative principalPaid across all 5 years equals the loan's principal reduction over 60 months (706000 - 622781.27)", () => {
    const totalPrincipalPaid = realProjection.reduce((sum, row) => sum + row.principalPaid!, 0);
    expect(totalPrincipalPaid).toBeCloseTo(706000 - 622781.27, 2);
  });

  it("legacy flat-annualDebtService input still works unchanged (no interestPaid/principalPaid)", () => {
    const legacyRow = projectCashFlows({
      holdPeriodYears: 1,
      grossAnnualRent: 120000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 40000,
      rentGrowthRate: 0.03,
      expenseGrowthRate: 0.02,
      annualDebtService: 55000,
    })[0];

    expect(legacyRow.debtService).toBe(55000);
    expect(legacyRow.interestPaid).toBeUndefined();
    expect(legacyRow.principalPaid).toBeUndefined();
  });
});
