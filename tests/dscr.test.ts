import { calculateNOI, calculateDSCR, evaluateDSCR } from "../src/dscr";

describe("calculateNOI", () => {
  it("subtracts vacancy allowance and operating expenses from gross rent", () => {
    const noi = calculateNOI({
      grossAnnualRent: 100000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 30000,
    });

    // 100,000 - (100,000 * 5%) - 30,000 = 65,000
    expect(noi).toBeCloseTo(65000, 2);
  });
});

describe("calculateDSCR", () => {
  it("divides NOI by annual debt service", () => {
    const dscr = calculateDSCR({
      netOperatingIncome: 111000,
      annualDebtService: 90000,
    });

    expect(dscr).toBeCloseTo(1.2333, 4);
  });
});

describe("evaluateDSCR", () => {
  it("flags a property meeting the 1.20 lender minimum", () => {
    const result = evaluateDSCR({
      grossAnnualRent: 180000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 60000,
      annualDebtService: 90000,
    });

    // NOI = 180,000 - 9,000 - 60,000 = 111,000; DSCR = 111,000 / 90,000 = 1.2333
    expect(result.netOperatingIncome).toBeCloseTo(111000, 2);
    expect(result.dscr).toBeCloseTo(1.2333, 4);
    expect(result.meetsLenderMinimum).toBe(true);
  });

  it("flags a property falling below the 1.20 lender minimum", () => {
    const result = evaluateDSCR({
      grossAnnualRent: 150000,
      vacancyRatePercent: 0.05,
      annualOperatingExpenses: 50000,
      annualDebtService: 90000,
    });

    // NOI = 150,000 - 7,500 - 50,000 = 92,500; DSCR = 92,500 / 90,000 = 1.0278
    expect(result.netOperatingIncome).toBeCloseTo(92500, 2);
    expect(result.dscr).toBeCloseTo(1.0278, 4);
    expect(result.meetsLenderMinimum).toBe(false);
  });
});
