import { projectCashFlows } from "../src/E3-cashflow";
import { amortizationSchedule } from "../src/E2-amortization";
import { buildInvestmentCashFlowSeries, calculateIRR } from "../src/E5-returns";
import { calculateSalePrice, calculateExitProceeds } from "../src/E4-exit";

// Same $706,000 / 4.79% / 25yr / Canada loan as the E8 (amortization.ts) and
// E9 (cashflow.ts) golden tests. This is also used as "original purchase
// price" for the exit calc below: with downPaymentPercent 0 in that loan,
// principal === purchasePrice === $706,000, the same figure E9's fixture
// already builds its projection against, so there's one consistent
// property across E8/E9/E10, not a second unverified number.
const loan = {
  purchasePrice: 706000,
  downPaymentPercent: 0,
  annualInterestRate: 0.0479,
  amortizationYears: 25,
};
const country = "Canada" as const;
const holdPeriodYears = 5;

const projection = projectCashFlows({
  holdPeriodYears,
  grossAnnualRent: 120000,
  vacancyRatePercent: 0.05,
  annualOperatingExpenses: 40000,
  rentGrowthRate: 0.03,
  expenseGrowthRate: 0.02,
  loan,
  country,
});

describe("calculateSalePrice (standalone)", () => {
  it("flat_growth: back-solved appreciation rate reproduces the Design-confirmed $1,095,500 sale price", () => {
    // (1,095,500 / 706,000)^(1/5) - 1, computed independently before writing
    // this test (see conversation) — not read off the function under test.
    const appreciationRate = 0.09184637403573426;

    const salePrice = calculateSalePrice({
      method: "flat_growth",
      originalPurchasePrice: 706000,
      appreciationRate,
      holdPeriodYears,
    });

    expect(salePrice).toBeCloseTo(1095500, 1);
  });

  it("cap_rate: finalYearNOI / exitCapRate, hand-derived independent case", () => {
    // 85,010.72 is E9's already-hand-verified year-5 NOI (tests/cashflow.test.ts).
    // 85,010.72 / 0.05 = 1,700,214.40 by hand.
    const salePrice = calculateSalePrice({
      method: "cap_rate",
      finalYearNOI: 85010.72,
      exitCapRate: 0.05,
    });

    expect(salePrice).toBeCloseTo(1700214.4, 2);
  });
});

describe("calculateExitProceeds — flat growth method (Design-confirmed case)", () => {
  const appreciationRate = 0.09184637403573426;
  const equityInvested = 200000; // not a Design-confirmed figure — chosen to exercise fullCycleIRR wiring; see report

  const result = calculateExitProceeds({
    method: "flat_growth",
    originalPurchasePrice: 706000,
    appreciationRate,
    holdPeriodYears,
    sellingCostsRate: 0.07,
    loan,
    country,
    equityInvested,
    projection,
  });

  it("salePrice matches the Design-confirmed $1,095,500 figure", () => {
    expect(result.salePrice).toBeCloseTo(1095500, 1);
  });

  it("sellingCosts matches the Design-confirmed $76,685 figure exactly (1,095,500 * 0.07)", () => {
    expect(result.sellingCosts).toBeCloseTo(76685, 2);
  });

  it("remainingLoanBalance matches the Design/E8-confirmed $622,781 figure (±$1)", () => {
    expect(result.remainingLoanBalance).toBeCloseTo(622781, 0);
  });

  it("remainingLoanBalance exactly equals calling amortizationSchedule() directly with the same loan and month count — not a second, drift-able computation", () => {
    const directSchedule = amortizationSchedule(loan, country, holdPeriodYears * 12);
    expect(result.remainingLoanBalance).toBe(directSchedule[directSchedule.length - 1].closingBalance);
  });

  it("netSaleProceeds is $396,033.73, not the task brief's looser ~$396,000 estimate — flagged discrepancy, not silently reconciled", () => {
    // 1,095,500 - 76,685 - 622,781.27 = 396,033.73, computed independently
    // before writing this test (see conversation). This is $33.73 outside
    // the brief's stated "±$5" tolerance around $396,000 — the brief's
    // approximation was looser than the actual arithmetic, not an error in
    // this engine. Asserted against the precise, independently-derived
    // figure rather than force-fit to the looser one.
    expect(result.netSaleProceeds).toBeCloseTo(396033.73, 2);
  });

  it("fullCycleIRR matches a direct call to buildInvestmentCashFlowSeries()+calculateIRR() with the same inputs — proving the wiring, not a second IRR implementation", () => {
    const directSeries = buildInvestmentCashFlowSeries(equityInvested, projection, result.netSaleProceeds);
    const directIRR = calculateIRR(directSeries);

    expect(result.fullCycleIRR).toBe(directIRR);
  });
});

describe("calculateExitProceeds — cap rate method (independent hand-derived case)", () => {
  const equityInvested = 200000;

  const result = calculateExitProceeds({
    method: "cap_rate",
    exitCapRate: 0.05,
    holdPeriodYears,
    sellingCostsRate: 0.07,
    loan,
    country,
    equityInvested,
    projection,
  });

  it("pulls finalYearNOI from the projection's last row rather than recomputing it (salePrice = 85,010.71794 / 0.05)", () => {
    // 85,010.72 (used in the standalone calculateSalePrice test above) is
    // E9's *rounded* year-5 NOI assertion. The real, unrounded year-5 NOI is
    // 85,010.71794 (independently recomputed by hand from the same
    // grossAnnualRent/growth-rate inputs before writing this test — see
    // conversation), which is what this end-to-end path actually pulls off
    // the projection's last row. 85,010.71794 / 0.05 = 1,700,214.3588.
    expect(result.salePrice).toBeCloseTo(1700214.3588, 2);
  });

  it("sellingCosts = salePrice * 0.07, hand-derived (1,700,214.3588 * 0.07 = 119,015.0051)", () => {
    expect(result.sellingCosts).toBeCloseTo(119015.0051, 2);
  });

  it("netSaleProceeds hand-derived (1,700,214.3588 - 119,015.0051 - 622,781.2656 = 958,418.088)", () => {
    expect(result.netSaleProceeds).toBeCloseTo(958418.088, 2);
  });

  it("remainingLoanBalance exactly equals calling amortizationSchedule() directly, same as the flat-growth case", () => {
    const directSchedule = amortizationSchedule(loan, country, holdPeriodYears * 12);
    expect(result.remainingLoanBalance).toBe(directSchedule[directSchedule.length - 1].closingBalance);
  });
});
