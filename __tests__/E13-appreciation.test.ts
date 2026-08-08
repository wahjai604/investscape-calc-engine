import { calculateAppreciation } from "../src/E13-appreciation";
import { AppreciationInput } from "../src/types";

// Template v2 base deal: $550,000 purchase, same purchase price used
// throughout this session's other E-series golden cases.
const baseInput: AppreciationInput = {
  purchasePrice: 550000,
  downPaymentPercent: 0.275,
  initialEquity: 162250, // 27.5% down ($151,250) + ~2% closing costs ($11,000)
  holdPeriodYears: 5,
  annualAppreciationRate: 0.03,
  remainingLoanBalance: 350000,
};

describe("calculateAppreciation", () => {
  it("Template v2 golden case: $550K, 3% annual, 5-year hold → projectedSalePrice ≈ $637,601, totalAppreciation ≈ $87,601", () => {
    const result = calculateAppreciation(baseInput);

    // Exact value: 550,000 * 1.03^5 = 637,600.740865
    expect(result.projectedSalePrice).toBeCloseTo(637600.74, 2);
    expect(result.totalAppreciation).toBeCloseTo(87600.74, 2);
    expect(result.purchasePrice).toBe(550000);
    expect(result.annualizedAppreciationRate).toBe(0.03);
  });

  it("zero appreciation (flat market): $550K, 0%, 5 years → projectedSalePrice = purchasePrice", () => {
    const result = calculateAppreciation({ ...baseInput, annualAppreciationRate: 0 });

    expect(result.projectedSalePrice).toBe(550000);
    expect(result.totalAppreciation).toBe(0);
    expect(result.appreciationPercent).toBe(0);
  });

  it("high appreciation (5% annual), 5 years → projectedSalePrice ≈ $701,955", () => {
    const result = calculateAppreciation({ ...baseInput, annualAppreciationRate: 0.05 });

    // Exact value: 550,000 * 1.05^5 = 701,954.859375
    expect(result.projectedSalePrice).toBeCloseTo(701954.86, 2);
    expect(result.totalAppreciation).toBeCloseTo(151954.86, 2);
    expect(result.appreciationPercent).toBeCloseTo(27.6281, 3);
  });

  it("long hold (10 years at 4%) → projectedSalePrice ≈ $814,134", () => {
    const result = calculateAppreciation({ ...baseInput, holdPeriodYears: 10, annualAppreciationRate: 0.04 });

    // Exact value: 550,000 * 1.04^10 = 814,134.356705
    expect(result.projectedSalePrice).toBeCloseTo(814134.36, 2);
    expect(result.totalAppreciation).toBeCloseTo(264134.36, 2);
    expect(result.annualizedAppreciationRate).toBe(0.04);
  });

  it("projected equity: $550K, 3%, 5 years, remainingLoanBalance=$350K → projectedEquity ≈ $287,601", () => {
    const result = calculateAppreciation(baseInput);

    // 637,600.740865 - 350,000 = 287,600.740865
    expect(result.projectedEquity).toBeCloseTo(287600.74, 2);
    expect(result.projectedEquity).toBeCloseTo(result.projectedSalePrice - baseInput.remainingLoanBalance, 6);
  });

  it("projected equity moves 1:1 with a lower remaining loan balance (more paid down → more equity)", () => {
    const moreEquity = calculateAppreciation({ ...baseInput, remainingLoanBalance: 300000 });
    const lessEquity = calculateAppreciation({ ...baseInput, remainingLoanBalance: 400000 });

    expect(moreEquity.projectedEquity - lessEquity.projectedEquity).toBeCloseTo(100000, 6);
  });

  describe("breakdown string", () => {
    it("includes the appreciation rate, hold period, purchase price, and projected sale price", () => {
      const result = calculateAppreciation(baseInput);

      expect(result.breakdown).toContain("3.00%");
      expect(result.breakdown).toContain("5 years");
      expect(result.breakdown).toContain("$550,000");
      expect(result.breakdown).toContain(result.projectedSalePrice.toFixed(2));
    });

    it("includes the remaining loan balance and the resulting projected equity", () => {
      const result = calculateAppreciation(baseInput);

      expect(result.breakdown).toContain(baseInput.remainingLoanBalance.toFixed(2));
      expect(result.breakdown).toContain(result.projectedEquity.toFixed(2));
    });

    it("includes the equity gain relative to initialEquity", () => {
      const result = calculateAppreciation(baseInput);
      const equityGain = result.projectedEquity - baseInput.initialEquity;

      expect(result.breakdown).toContain(equityGain.toFixed(2));
      expect(result.breakdown).toContain("$162,250");
    });

    it("uses singular 'year' for a 1-year hold instead of '1 years'", () => {
      const result = calculateAppreciation({ ...baseInput, holdPeriodYears: 1 });
      expect(result.breakdown).toContain("1 year,");
      expect(result.breakdown).not.toContain("1 years");
    });
  });
});
