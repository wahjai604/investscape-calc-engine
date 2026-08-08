/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateDataProvenance } from "../src/E19-data-provenance";
import { DataProvenanceInput } from "../src/types";

// Fixed reference "now" so ageInDays/recencyScore are deterministic —
// calculateDataProvenance's now parameter exists specifically for this;
// see its JSDoc in src/data-provenance.ts.
const NOW = new Date("2026-08-04T00:00:00Z");

describe("calculateDataProvenance", () => {
  describe("1. all fields recent + high confidence", () => {
    // NOTE: the task brief for this scenario expected overallDataQualityScore
    // ~92-95%, but that's mathematically unreachable with "appraised" source
    // (sourceScore=100) at 0.95-0.98 confidence and full recency — the
    // formula's floor for that exact combination is qualityScore =
    // 100*0.5 + 95*0.3 + 100*0.2 = 98.5 at the low end of the stated
    // confidence range, rising to 99.4 at the high end. Verified by running
    // the actual engine before writing these assertions; ~92-95% was not
    // reproducible from "all appraised, 0.95-0.98, <=5 days old" under the
    // existing (correct, unmodified) qualityScore formula.
    const input: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "appraised", confidence: 0.98, lastUpdatedDate: "2026-08-03" },
      downPaymentPercent: { value: 0.275, source: "appraised", confidence: 0.97, lastUpdatedDate: "2026-08-02" },
      annualInterestRate: { value: 0.0454, source: "appraised", confidence: 0.96, lastUpdatedDate: "2026-08-01" },
      amortizationYears: { value: 25, source: "appraised", confidence: 0.95, lastUpdatedDate: "2026-07-31" },
      grossAnnualRent: { value: 42000, source: "appraised", confidence: 0.98, lastUpdatedDate: "2026-07-30" },
      vacancyRatePercent: { value: 0.05, source: "appraised", confidence: 0.97, lastUpdatedDate: "2026-08-03" },
      annualOperatingExpenses: { value: 15000, source: "appraised", confidence: 0.96, lastUpdatedDate: "2026-08-02" },
      equityInvested: { value: 162250, source: "appraised", confidence: 0.95, lastUpdatedDate: "2026-08-01" },
    };
    const result = calculateDataProvenance(input, NOW);

    it("overallDataQualityScore is very high (~99%), not merely 92-95%", () => {
      expect(result.overallDataQualityScore).toBeGreaterThan(95);
      expect(result.overallDataQualityScore).toBeCloseTo(99.07, 2);
    });

    it("every field shows a High confidence label", () => {
      expect(result.fieldsTracked).toHaveLength(8);
      expect(result.fieldsTracked.every((f) => f.confidenceLabel === "High")).toBe(true);
    });

    it("produces no recommendedActions (nothing missing, nothing low-confidence, nothing stale)", () => {
      expect(result.recommendedActions).toEqual([]);
    });
  });

  describe("2. mixed sources (high + low)", () => {
    // NOTE: the task brief expected ~70-75%, but purchasePrice — the
    // heaviest-weighted field (weight 3) — is "appraised" at 0.95 confidence
    // and only 3 days old, giving it a 98.5 individual qualityScore that
    // pulls the weighted average up well above that range. Verified: the
    // actual weighted average is 82.08%, not 70-75%.
    const input: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "appraised", confidence: 0.95, lastUpdatedDate: "2026-08-01" }, // 3 days old
      grossAnnualRent: { value: 42000, source: "user_input", confidence: 0.7, lastUpdatedDate: "2026-07-25" }, // 10 days old
      annualOperatingExpenses: { value: 15000, source: "estimated", confidence: 0.5, lastUpdatedDate: "2026-07-05" }, // 30 days old
    };
    const result = calculateDataProvenance(input, NOW);

    it("overallDataQualityScore reflects the weighted mix (82.08%), not a simple average", () => {
      expect(result.overallDataQualityScore).toBeCloseTo(82.08, 2);

      // Weighted average check: purchasePrice weight 3, grossAnnualRent
      // weight 2, annualOperatingExpenses weight 1 (per FIELD_META).
      const [pp, rent, opex] = result.fieldsTracked;
      const expectedWeightedAverage = (pp.qualityScore * 3 + rent.qualityScore * 2 + opex.qualityScore * 1) / 6;
      expect(result.overallDataQualityScore).toBeCloseTo(expectedWeightedAverage, 6);

      // A naive unweighted average would be different — proving the weights actually apply.
      const naiveAverage = (pp.qualityScore + rent.qualityScore + opex.qualityScore) / 3;
      expect(result.overallDataQualityScore).not.toBeCloseTo(naiveAverage, 2);
    });

    it("purchasePrice (appraised, high confidence, fresh) scores highest of the three", () => {
      const [pp, rent, opex] = result.fieldsTracked;
      expect(pp.qualityScore).toBeGreaterThan(rent.qualityScore);
      expect(pp.qualityScore).toBeGreaterThan(opex.qualityScore);
      expect(pp.confidenceLabel).toBe("High");
    });

    it("grossAnnualRent and annualOperatingExpenses score Moderate", () => {
      const [, rent, opex] = result.fieldsTracked;
      expect(rent.confidenceLabel).toBe("Moderate");
      expect(opex.confidenceLabel).toBe("Moderate");
    });
  });

  describe("3. stale data (all fields 1 year old)", () => {
    const input: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-04" },
      downPaymentPercent: { value: 0.275, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-04" },
      annualInterestRate: { value: 0.0454, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-03" },
      amortizationYears: { value: 25, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-03" },
      grossAnnualRent: { value: 42000, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-04" },
      vacancyRatePercent: { value: 0.05, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-04" },
      annualOperatingExpenses: { value: 15000, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-03" },
      equityInvested: { value: 162250, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-03" },
    };
    const result = calculateDataProvenance(input, NOW);

    it("recencyScore is 0 for every field (365+ days old)", () => {
      // qualityScore = sourceScore(95)*0.5 + confidenceScore(90)*0.3 + recencyScore*0.2.
      // With recencyScore=0: 47.5 + 27 + 0 = 74.5 exactly, for every field.
      expect(result.fieldsTracked.every((f) => f.qualityScore === 74.5)).toBe(true);
      expect(result.overallDataQualityScore).toBeCloseTo(74.5, 6);
    });

    it("quality degrades significantly vs. the same data fresh (94.5 fresh vs 74.5 stale — a 20-point drop)", () => {
      const freshEquivalent = calculateDataProvenance(
        { purchasePrice: { value: 550000, source: "market_data", confidence: 0.9, lastUpdatedDate: "2026-08-01" } },
        NOW,
      );
      const staleEquivalent = calculateDataProvenance(
        { purchasePrice: { value: 550000, source: "market_data", confidence: 0.9, lastUpdatedDate: "2025-08-04" } },
        NOW,
      );
      expect(freshEquivalent.fieldsTracked[0].qualityScore).toBeCloseTo(94.5, 6);
      expect(staleEquivalent.fieldsTracked[0].qualityScore).toBeCloseTo(74.5, 6);
      expect(freshEquivalent.fieldsTracked[0].qualityScore - staleEquivalent.fieldsTracked[0].qualityScore).toBeCloseTo(20, 6);
    });

    it('recommendedActions flags every field: "X has not been updated in over 1 year — verify current market."', () => {
      expect(result.recommendedActions).toHaveLength(8);
      expect(result.recommendedActions).toContain("Purchase price has not been updated in over 1 year — verify current market.");
      expect(result.recommendedActions).toContain("Rent has not been updated in over 1 year — verify current market.");
      expect(result.recommendedActions.every((a) => a.includes("has not been updated in over 1 year — verify current market."))).toBe(
        true,
      );
      // The generic ">30 days" wording must NOT appear for these fields — the >=365-day case has its own distinct message.
      expect(result.recommendedActions.some((a) => a.includes("days old"))).toBe(false);
    });
  });

  describe("4. missing fields", () => {
    const input: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "market_data", confidence: 0.9, lastUpdatedDate: "2026-08-01" },
    };
    const result = calculateDataProvenance(input, NOW);

    it("fieldsTracked has exactly 1 entry", () => {
      expect(result.fieldsTracked).toHaveLength(1);
      expect(result.fieldsTracked[0].fieldName).toBe("purchasePrice");
    });

    it("recommendedActions lists all 7 missing fields", () => {
      expect(result.recommendedActions).toHaveLength(7);
    });

    it('flags the missing operating-expenses field using its display name ("Expenses has not yet been provided.") — not the raw field name annualOperatingExpenses', () => {
      // The task brief described this as verifying
      // "annualOperatingExpenses has not yet been provided" — but
      // recommendedActions messages use FIELD_META's friendly displayName
      // ("Expenses"), not the raw camelCase field key, matching this
      // module's existing (and more user-facing-appropriate) design.
      // Verified against the actual engine output before writing this.
      expect(result.recommendedActions).toContain("Expenses has not yet been provided.");
      expect(result.recommendedActions.some((a) => a.includes("annualOperatingExpenses"))).toBe(false);
    });

    it("does not include the missing fields in fieldsTracked", () => {
      const trackedNames = result.fieldsTracked.map((f) => f.fieldName);
      expect(trackedNames).not.toContain("annualOperatingExpenses");
      expect(trackedNames).not.toContain("grossAnnualRent");
    });
  });

  describe("5. edge case: recent but low confidence", () => {
    const lowConfidence: DataProvenanceInput = {
      grossAnnualRent: { value: 42000, source: "market_data", confidence: 0.3, lastUpdatedDate: "2026-08-02" }, // 2 days old
    };
    const highConfidenceSameRecency: DataProvenanceInput = {
      grossAnnualRent: { value: 42000, source: "market_data", confidence: 0.95, lastUpdatedDate: "2026-08-02" },
    };

    it('confidenceLabel is "Low" despite the field being only 2 days old', () => {
      const result = calculateDataProvenance(lowConfidence, NOW);
      expect(result.fieldsTracked[0].confidenceLabel).toBe("Low");
      expect(result.fieldsTracked[0].ageInDays).toBe(2);
    });

    it("confidence materially degrades quality even with perfect recency: low-confidence scores well below the high-confidence equivalent", () => {
      const lowResult = calculateDataProvenance(lowConfidence, NOW);
      const highResult = calculateDataProvenance(highConfidenceSameRecency, NOW);

      // Same source, same recency — only confidence differs (0.3 vs 0.95).
      expect(lowResult.fieldsTracked[0].qualityScore).toBeLessThan(highResult.fieldsTracked[0].qualityScore);
      // Confidence difference (0.95 - 0.3 = 0.65) × confidenceScore's 30% weight × 100 = 19.5 points.
      expect(highResult.fieldsTracked[0].qualityScore - lowResult.fieldsTracked[0].qualityScore).toBeCloseTo(19.5, 6);
    });

    it("gets flagged in recommendedActions for low confidence", () => {
      const result = calculateDataProvenance(lowConfidence, NOW);
      expect(result.recommendedActions.some((a) => a.includes("low confidence"))).toBe(true);
    });
  });

  describe("6. edge case: old but high confidence", () => {
    const oldHighConfidence: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "appraised", confidence: 0.98, lastUpdatedDate: "2026-02-05" }, // 180 days old
    };
    const freshEquivalent: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "appraised", confidence: 0.98, lastUpdatedDate: "2026-08-03" }, // 1 day old
    };

    it("confidenceLabel stays High regardless of age (label is confidence-only, not composite quality)", () => {
      const result = calculateDataProvenance(oldHighConfidence, NOW);
      expect(result.fieldsTracked[0].confidenceLabel).toBe("High");
      expect(result.fieldsTracked[0].ageInDays).toBe(180);
    });

    it("age still meaningfully discounts the composite qualityScore vs. the same data fresh — confidence offsets but doesn't fully cancel the age penalty", () => {
      const oldResult = calculateDataProvenance(oldHighConfidence, NOW);
      const freshResult = calculateDataProvenance(freshEquivalent, NOW);

      expect(oldResult.fieldsTracked[0].qualityScore).toBeLessThan(freshResult.fieldsTracked[0].qualityScore);
      expect(oldResult.fieldsTracked[0].qualityScore).toBeCloseTo(90.44, 2);
      // Still well above a "moderate" result — high source + high confidence
      // dominate the formula (0.5 + 0.3 weight) over recency's 0.2 weight.
      expect(oldResult.fieldsTracked[0].qualityScore).toBeGreaterThan(85);
    });

    it("gets flagged for staleness even though confidence is high", () => {
      const result = calculateDataProvenance(oldHighConfidence, NOW);
      expect(result.recommendedActions.some((a) => a.includes("180 days old"))).toBe(true);
    });
  });

  describe("7. full golden case (Template v2 deal)", () => {
    const input: DataProvenanceInput = {
      purchasePrice: { value: 550000, source: "appraised", confidence: 0.95, lastUpdatedDate: "2026-08-01" },
      downPaymentPercent: { value: 0.275, source: "user_input", confidence: 1.0, lastUpdatedDate: "2026-08-04" },
      annualInterestRate: { value: 0.0454, source: "market_data", confidence: 0.9, lastUpdatedDate: "2026-07-25" },
      amortizationYears: { value: 25, source: "user_input", confidence: 1.0, lastUpdatedDate: "2026-08-04" },
      grossAnnualRent: { value: 42000, source: "market_data", confidence: 0.85, lastUpdatedDate: "2026-07-20" },
      vacancyRatePercent: { value: 0.05, source: "estimated", confidence: 0.6, lastUpdatedDate: "2026-07-15" },
      annualOperatingExpenses: { value: 15000, source: "estimated", confidence: 0.65, lastUpdatedDate: "2026-07-10" },
      equityInvested: { value: 162250, source: "calculated", confidence: 1.0, lastUpdatedDate: "2026-08-04" },
    };
    const result = calculateDataProvenance(input, NOW);

    it("overallDataQualityScore lands in the expected 80-88% band", () => {
      expect(result.overallDataQualityScore).toBeGreaterThanOrEqual(80);
      expect(result.overallDataQualityScore).toBeLessThanOrEqual(88);
      expect(result.overallDataQualityScore).toBeCloseTo(86.45, 2);
    });

    it("summary text includes the rounded quality score", () => {
      expect(result.summary).toContain("86%");
    });

    it('summary reports "none" for key uncertainties when no field is Low/Uncertain', () => {
      expect(result.fieldsTracked.every((f) => f.confidenceLabel === "High" || f.confidenceLabel === "Moderate")).toBe(true);
      expect(result.summary).toContain("Key uncertainties: none.");
    });
  });

  describe("confidenceLabel boundaries", () => {
    function labelFor(confidence: number): string {
      const result = calculateDataProvenance(
        { purchasePrice: { value: 100000, source: "market_data", confidence, lastUpdatedDate: "2026-08-04" } },
        NOW,
      );
      return result.fieldsTracked[0].confidenceLabel;
    }

    it("High: >= 0.8", () => {
      expect(labelFor(0.8)).toBe("High");
      expect(labelFor(1.0)).toBe("High");
    });

    it("Moderate: >= 0.5 and < 0.8", () => {
      expect(labelFor(0.5)).toBe("Moderate");
      expect(labelFor(0.79)).toBe("Moderate");
    });

    it("Low: >= 0.25 and < 0.5", () => {
      expect(labelFor(0.25)).toBe("Low");
      expect(labelFor(0.49)).toBe("Low");
    });

    it("Uncertain: < 0.25", () => {
      expect(labelFor(0.24)).toBe("Uncertain");
      expect(labelFor(0)).toBe("Uncertain");
    });
  });

  describe("age calculation (ageInDays)", () => {
    it("computes exact day counts against the fixed reference date", () => {
      const result = calculateDataProvenance(
        {
          purchasePrice: { value: 1, source: "user_input", confidence: 1, lastUpdatedDate: "2026-08-04" }, // same day
          grossAnnualRent: { value: 1, source: "user_input", confidence: 1, lastUpdatedDate: "2026-08-03" }, // 1 day
          annualOperatingExpenses: { value: 1, source: "user_input", confidence: 1, lastUpdatedDate: "2026-07-05" }, // 30 days
          annualInterestRate: { value: 1, source: "user_input", confidence: 1, lastUpdatedDate: "2025-08-04" }, // 365 days
        },
        NOW,
      );

      const byField = Object.fromEntries(result.fieldsTracked.map((f) => [f.fieldName, f.ageInDays]));
      expect(byField.purchasePrice).toBe(0);
      expect(byField.grossAnnualRent).toBe(1);
      expect(byField.annualOperatingExpenses).toBe(30);
      expect(byField.annualInterestRate).toBe(365);
    });

    it("defaults to the real current time when now is omitted (doesn't throw, produces a non-negative age)", () => {
      const result = calculateDataProvenance({
        purchasePrice: { value: 100000, source: "user_input", confidence: 1, lastUpdatedDate: "2020-01-01" },
      });
      expect(result.fieldsTracked[0].ageInDays).toBeGreaterThan(0);
    });
  });

  describe("recommendedActions content", () => {
    it("distinguishes the three message types: missing, low confidence, and stale", () => {
      const result = calculateDataProvenance(
        {
          purchasePrice: { value: 100000, source: "estimated", confidence: 0.2, lastUpdatedDate: "2025-01-01" }, // low confidence AND very stale
          // grossAnnualRent, etc. all omitted -> missing
        },
        NOW,
      );

      const missingActions = result.recommendedActions.filter((a) => a.includes("has not yet been provided"));
      const confidenceActions = result.recommendedActions.filter((a) => a.includes("confidence"));
      const staleActions = result.recommendedActions.filter((a) => a.includes("has not been updated in over 1 year"));

      expect(missingActions.length).toBe(7); // every field except purchasePrice
      expect(confidenceActions).toContain("Purchase price has uncertain confidence (estimated) — consider verifying.");
      expect(staleActions).toContain("Purchase price has not been updated in over 1 year — verify current market.");
    });
  });
});
