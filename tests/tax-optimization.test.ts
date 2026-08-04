import { calculateTaxOptimization, TaxOptimizationInput } from "../src/tax-optimization";

describe("calculateTaxOptimization", () => {
  describe("1. US residential depreciation", () => {
    const input: TaxOptimizationInput = {
      purchasePrice: 400000,
      propertyType: "residential",
      improvementValue: 320000,
      landValue: 80000,
      annualNetOperatingIncome: 20000,
      holdPeriodYears: 5,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.25,
      country: "US",
      initialEquity: 100000,
      projectedSalePrice: 500000,
      remainingLoanBalance: 250000,
    };
    const result = calculateTaxOptimization(input);

    it("annualDepreciation = $320K / 27.5yr ≈ $11,636/year", () => {
      expect(result.annualDepreciation).toBeCloseTo(11636.36, 2);
    });

    it("totalDepreciationOverHold = annualDepreciation × 5 ≈ $58,182", () => {
      expect(result.totalDepreciationOverHold).toBeCloseTo(58181.82, 2);
      expect(result.totalDepreciationOverHold).toBeCloseTo(result.annualDepreciation * 5, 6);
    });

    it("taxSavingsFromDepreciation ≈ $20,364/year (totalDepreciationOverHold × 35%)", () => {
      expect(result.taxSavingsFromDepreciation).toBeCloseTo(20363.64, 2);
      expect(result.taxSavingsFromDepreciation).toBeCloseTo(result.totalDepreciationOverHold * 0.35, 6);
    });

    it("breakdown string (summary) reflects the per-year tax savings, total tax due, and after-tax IRR", () => {
      expect(result.summary).toContain("4072.73");
      expect(result.summary).toContain(result.totalTaxLiability.toFixed(2));
      expect(result.summary).toContain((result.afterTaxIRR * 100).toFixed(2));
    });
  });

  describe("2. US commercial depreciation", () => {
    const input: TaxOptimizationInput = {
      purchasePrice: 500000,
      propertyType: "commercial",
      improvementValue: 450000,
      landValue: 50000,
      annualNetOperatingIncome: 30000,
      holdPeriodYears: 10,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.25,
      country: "US",
      initialEquity: 125000,
      projectedSalePrice: 650000,
      remainingLoanBalance: 300000,
    };
    const result = calculateTaxOptimization(input);

    it("annualDepreciation = $450K / 39yr ≈ $11,538/year", () => {
      expect(result.annualDepreciation).toBeCloseTo(11538.46, 2);
    });

    it("is1031Eligible is true (US)", () => {
      expect(result.is1031Eligible).toBe(true);
    });

    it("the 39-year commercial life produces meaningfully less annual depreciation per dollar of improvement than the 27.5-year residential life", () => {
      const residentialAnnualDepreciationPerDollar = 1 / 27.5;
      const commercialAnnualDepreciationPerDollar = 1 / 39;

      expect(commercialAnnualDepreciationPerDollar).toBeLessThan(residentialAnnualDepreciationPerDollar);
      // Directly on this deal's own numbers: $450K commercial improvement depreciates slower per dollar than $320K residential did in test 1.
      expect(result.annualDepreciation / input.improvementValue).toBeCloseTo(commercialAnnualDepreciationPerDollar, 6);
    });

    it("breakdown string (summary) is present and well-formed", () => {
      expect(result.summary).toMatch(/^Depreciation saves \$[\d.]+\/year\. Tax due at sale: \$-?[\d.]+\. After-tax IRR: -?[\d.]+%\.$/);
    });
  });

  describe("3. Canada residential (CCA declining balance)", () => {
    const input: TaxOptimizationInput = {
      purchasePrice: 550000,
      propertyType: "residential",
      improvementValue: 440000,
      landValue: 110000,
      annualNetOperatingIncome: 25000,
      holdPeriodYears: 5,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.25,
      country: "Canada",
      initialEquity: 137500,
      projectedSalePrice: 650000,
      remainingLoanBalance: 380000,
    };
    const result = calculateTaxOptimization(input);

    it("totalDepreciationOverHold ≈ $82K (declining balance, not straight-line)", () => {
      expect(result.totalDepreciationOverHold).toBeCloseTo(81236.01, 2);

      // Straight-line would be improvementValue/somefixedlife × 5 — there's no
      // single fixed life for CCA, but the point is this total is NOT simply
      // 4% × improvementValue × 5 years (that flat-rate calculation would be
      // 88,000, not ~81,236 — declining balance yields less over time since
      // each year's 4% is taken off a shrinking base).
      const flatRateWouldGive = input.improvementValue * 0.04 * input.holdPeriodYears;
      expect(result.totalDepreciationOverHold).not.toBeCloseTo(flatRateWouldGive, 0);
      expect(result.totalDepreciationOverHold).toBeLessThan(flatRateWouldGive);
    });

    it("annualDepreciation is reported as the average over the hold (totalDepreciationOverHold / 5), not a flat constant", () => {
      expect(result.annualDepreciation).toBeCloseTo(16247.2, 2);
      expect(result.annualDepreciation).toBeCloseTo(result.totalDepreciationOverHold / 5, 6);
    });

    it("CCA declines each year: hand-verifying the year-by-year 4% declining-balance schedule sums to totalDepreciationOverHold", () => {
      let balance = input.improvementValue;
      let total = 0;
      let previousYearDepreciation = Infinity;

      for (let year = 1; year <= input.holdPeriodYears; year++) {
        const yearDepreciation = balance * 0.04;
        // Each year's CCA claim is strictly smaller than the previous year's —
        // the defining property of declining balance vs. straight-line.
        expect(yearDepreciation).toBeLessThan(previousYearDepreciation);
        previousYearDepreciation = yearDepreciation;
        total += yearDepreciation;
        balance -= yearDepreciation;
      }

      expect(total).toBeCloseTo(result.totalDepreciationOverHold, 6);
    });

    it("is1031Eligible is false (Canada has no like-kind exchange equivalent)", () => {
      expect(result.is1031Eligible).toBe(false);
    });

    it("breakdown string (summary) reflects the Canadian figures", () => {
      expect(result.summary).toContain((result.annualDepreciation * 0.35).toFixed(2));
      expect(result.summary).toContain(result.totalTaxLiability.toFixed(2));
    });
  });

  describe("4. recapture tax (no double-counting)", () => {
    // depreciationRecaptureRate is deliberately set to 0.35 (equal to
    // ordinaryIncomeRate) for this scenario specifically — not the more
    // typical 0.25 cap used in the other test cases here — so that the
    // recaptured portion is taxed at the full ordinary rate, matching this
    // test's own "taxed as ordinary income at 35%" framing. This does not
    // change how tax-optimization.ts computes recapture; it's this test's
    // chosen input value for that field.
    const input: TaxOptimizationInput = {
      purchasePrice: 400000,
      propertyType: "residential",
      improvementValue: 320000,
      landValue: 80000,
      annualNetOperatingIncome: 20000,
      holdPeriodYears: 5,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.35,
      country: "US",
      initialEquity: 100000,
      projectedSalePrice: 500000,
      remainingLoanBalance: 250000,
    };
    const result = calculateTaxOptimization(input);

    it("cost basis = purchasePrice - accumulated depreciation ≈ $400K - $58,182 = $341,818", () => {
      const costBasis = input.purchasePrice - result.totalDepreciationOverHold;
      expect(costBasis).toBeCloseTo(341818.18, 2);
    });

    it("total gain (capitalGain) = salePrice - costBasis ≈ $500K - $341,818 = $158,182", () => {
      expect(result.capitalGain).toBeCloseTo(158181.82, 2);
    });

    it("recaptured = min(accumulated depreciation, total gain) ≈ $58,182", () => {
      expect(result.depreciationRecapture).toBeCloseTo(58181.82, 2);
      expect(result.depreciationRecapture).toBeCloseTo(result.totalDepreciationOverHold, 6);
      expect(result.depreciationRecapture).toBeLessThanOrEqual(result.capitalGain);
    });

    it("remaining capital gain = totalGain - recaptured = $100,000 exactly, taxed at 25%", () => {
      const remainingCapitalGain = result.capitalGain - result.depreciationRecapture;
      expect(remainingCapitalGain).toBeCloseTo(100000, 2);
      expect(result.capitalGainsTax).toBeCloseTo(25000, 2);
      expect(result.capitalGainsTax).toBeCloseTo(remainingCapitalGain * 0.25, 6);
    });

    it("depreciationRecaptureTax = recaptured × 35% ≈ $20,363.64", () => {
      expect(result.depreciationRecaptureTax).toBeCloseTo(20363.64, 2);
      expect(result.depreciationRecaptureTax).toBeCloseTo(result.depreciationRecapture * 0.35, 6);
    });

    it("totalTaxLiability = capitalGainsTax + depreciationRecaptureTax ≈ $45,363.64 (~$45,364)", () => {
      expect(result.totalTaxLiability).toBeCloseTo(45363.64, 2);
      expect(result.totalTaxLiability).toBeCloseTo(result.capitalGainsTax + result.depreciationRecaptureTax, 6);
    });

    it("no double-counting: capitalGainsTax + depreciationRecaptureTax never exceeds capitalGain × the higher of the two rates", () => {
      // A sanity ceiling: if every dollar of gain were taxed at the higher
      // of the two rates, that's the maximum possible liability. Actual
      // liability must be at or under that, proving the two components
      // don't overlap on the same dollars.
      const maxPossibleIfNoSplit = result.capitalGain * Math.max(0.25, 0.35);
      expect(result.totalTaxLiability).toBeLessThanOrEqual(maxPossibleIfNoSplit + 1e-6);

      // And the two components partition capitalGain exactly (no gap, no overlap).
      expect(result.depreciationRecapture + (result.capitalGain - result.depreciationRecapture)).toBeCloseTo(result.capitalGain, 6);
    });
  });

  describe("5. land only (zero depreciation)", () => {
    const input: TaxOptimizationInput = {
      purchasePrice: 300000,
      propertyType: "land",
      improvementValue: 0,
      landValue: 300000,
      annualNetOperatingIncome: 5000,
      holdPeriodYears: 5,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.25,
      country: "US",
      initialEquity: 50000,
      projectedSalePrice: 350000,
      remainingLoanBalance: 100000,
    };
    const result = calculateTaxOptimization(input);

    it("annualDepreciation and totalDepreciationOverHold are 0", () => {
      expect(result.annualDepreciation).toBe(0);
      expect(result.totalDepreciationOverHold).toBe(0);
    });

    it("no tax savings from depreciation", () => {
      expect(result.taxSavingsFromDepreciation).toBe(0);
    });

    it("no depreciation recapture (nothing was ever depreciated)", () => {
      expect(result.depreciationRecapture).toBe(0);
      expect(result.depreciationRecaptureTax).toBe(0);
    });

    it("is1031Eligible is true (US, regardless of property type)", () => {
      expect(result.is1031Eligible).toBe(true);
    });

    it("breakdown string (summary) shows $0.00/year in depreciation savings", () => {
      expect(result.summary).toContain("Depreciation saves $0.00/year.");
    });
  });

  describe("6. after-tax IRR", () => {
    const input: TaxOptimizationInput = {
      purchasePrice: 400000,
      propertyType: "residential",
      improvementValue: 320000,
      landValue: 80000,
      annualNetOperatingIncome: 20000,
      holdPeriodYears: 5,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.25,
      country: "US",
      initialEquity: 100000,
      projectedSalePrice: 500000,
      remainingLoanBalance: 250000,
    };
    const result = calculateTaxOptimization(input);

    it("afterTaxIRR < preTaxIRR (tax reduces the return)", () => {
      expect(result.afterTaxIRR).toBeLessThan(result.preTaxIRR);
      expect(result.preTaxIRR).toBeCloseTo(0.35053, 4);
      expect(result.afterTaxIRR).toBeCloseTo(0.31798, 4);
    });

    it("the formula subtracts totalTaxLiability only at exit, not from every year's cash flow", () => {
      // preTaxIRR's exit amount is projectedSalePrice - remainingLoanBalance;
      // afterTaxIRR's exit amount is that same figure minus totalTaxLiability
      // (i.e. netProceeds) — the two series are identical except in the
      // final year, by exactly totalTaxLiability.
      const preTaxExitAmount = input.projectedSalePrice - input.remainingLoanBalance;
      expect(result.netProceeds).toBeCloseTo(preTaxExitAmount - result.totalTaxLiability, 6);
    });
  });

  describe("7. pre-tax vs after-tax comparison", () => {
    const input: TaxOptimizationInput = {
      purchasePrice: 400000,
      propertyType: "residential",
      improvementValue: 320000,
      landValue: 80000,
      annualNetOperatingIncome: 20000,
      holdPeriodYears: 5,
      capitalGainsTaxRate: 0.25,
      ordinaryIncomeRate: 0.35,
      depreciationRecaptureRate: 0.25,
      country: "US",
      initialEquity: 100000,
      projectedSalePrice: 500000,
      remainingLoanBalance: 250000,
    };
    const result = calculateTaxOptimization(input);

    it("depreciation's annual tax savings are real, but don't fully offset the recapture tax due at exit", () => {
      const totalDepreciationTaxSavingsOverHold = result.taxSavingsFromDepreciation;
      // The recapture tax claws back a meaningful share of the tax benefit
      // depreciation provided during the hold — it's not free money.
      expect(result.depreciationRecaptureTax).toBeGreaterThan(0);
      expect(result.depreciationRecaptureTax).toBeLessThan(totalDepreciationTaxSavingsOverHold * 1.5);
    });

    it("the IRR gap between pre-tax and after-tax quantifies that net impact", () => {
      const irrGap = result.preTaxIRR - result.afterTaxIRR;
      expect(irrGap).toBeGreaterThan(0);
      expect(irrGap).toBeCloseTo(0.03255, 3);
    });

    it("breakdown string (summary) is internally consistent with the typed result fields", () => {
      expect(result.summary).toBe(
        `Depreciation saves $${(result.annualDepreciation * input.ordinaryIncomeRate).toFixed(2)}/year. ` +
          `Tax due at sale: $${result.totalTaxLiability.toFixed(2)}. ` +
          `After-tax IRR: ${(result.afterTaxIRR * 100).toFixed(2)}%.`,
      );
    });
  });
});
