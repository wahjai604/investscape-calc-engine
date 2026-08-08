/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Test methodology and validation data are proprietary.
 * See LICENSE for usage restrictions.
 */

import { calculateLenderScorecard } from "../src/E25-lender-scorecard";
import { LenderScorecardInput } from "../src/types";

function baseInput(overrides: Partial<LenderScorecardInput> = {}): LenderScorecardInput {
  return {
    gdsRatio: 0.3,
    tdsRatio: 0.35,
    dscrRatio: 1.3,
    ltvPercent: 0.7,
    creditScoreEstimate: 760,
    country: "Canada",
    loanType: "conventional",
    propertyType: "residential",
    ...overrides,
  };
}

describe("calculateLenderScorecard — Canada, all metrics strong", () => {
  it("scores each metric at 25/25 and sums to a 100/100 overall score", () => {
    const result = calculateLenderScorecard(
      baseInput({ country: "Canada", gdsRatio: 0.3, tdsRatio: 0.38, dscrRatio: 1.3, ltvPercent: 0.7, creditScoreEstimate: 760 })
    );

    expect(result.scoreBreakdown).toEqual({ gds_score: 25, tds_score: 25, dscr_score: 25, ltv_score: 25 });
    expect(result.overallScore).toBe(100);
    expect(result.qualificationLikelihood).toBe("Likely bankable");
    expect(result.creditScore_context).toBe("Strong history");
    expect(result.flaggedIssues).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("summary reports 'No major issues identified' when the worst metric still scores full marks", () => {
    const result = calculateLenderScorecard(
      baseInput({ country: "Canada", gdsRatio: 0.3, tdsRatio: 0.38, dscrRatio: 1.3, ltvPercent: 0.7 })
    );

    expect(result.summary).toBe("Overall score: 100/100. Likely bankable. No major issues identified.");
  });
});

describe("calculateLenderScorecard — Canada, all metrics weak", () => {
  const weakCanada = baseInput({
    country: "Canada",
    gdsRatio: 0.42,
    tdsRatio: 0.48,
    dscrRatio: 0.75,
    ltvPercent: 0.92,
    creditScoreEstimate: 620,
  });
  const result = calculateLenderScorecard(weakCanada);

  it("scores each metric in its weak bracket and produces a low overall score", () => {
    expect(result.scoreBreakdown).toEqual({ gds_score: 5, tds_score: 5, dscr_score: 0, ltv_score: 0 });
    expect(result.overallScore).toBe(10);
    expect(result.qualificationLikelihood).toBe("Unlikely without fixes");
  });

  it("flags every metric below the 5-point threshold with an issue and a matching recommendation", () => {
    expect(result.flaggedIssues).toContain("GDS > 39% (threshold) — currently 42.0%.");
    expect(result.flaggedIssues).toContain("TDS > 44% (threshold) — currently 48.0%.");
    expect(result.flaggedIssues).toContain("DSCR < 1.0 (cash flow negative) — currently 0.75.");
    expect(result.flaggedIssues).toContain("LTV > 90% (threshold) — currently 92.0%.");

    expect(result.recommendations).toContain("Lower GDS by reducing the mortgage payment or increasing qualifying income.");
    expect(result.recommendations).toContain("Lower TDS by paying down other debt obligations.");
    expect(result.recommendations).toContain("Improve DSCR through higher rent or lower expenses.");
    expect(result.recommendations).toContain("Increase down payment to lower LTV below 80%.");
  });

  it("a credit score below 650 adds a 'may require explanation' recommendation, not a flagged issue", () => {
    expect(result.creditScore_context).toBe("May require explanation");
    expect(result.recommendations).toContain(
      "Credit score of 620 is below 650 and may require a written explanation or credit-repair plan before approval."
    );
    expect(result.flaggedIssues.some((f) => f.includes("620"))).toBe(false);
  });

  it("the worst-scoring metric (DSCR, tied lowest with LTV but evaluated first) drives the summary's key-issue text", () => {
    expect(result.summary).toBe("Overall score: 10/100. Unlikely without fixes. Key issue: DSCR at 0.75 is below the lender-preferred threshold.");
  });
});

describe("calculateLenderScorecard — US, GDS is not scored", () => {
  it("gds_score is always 0 for US and does not factor into overallScore's denominator", () => {
    const result = calculateLenderScorecard(
      baseInput({ country: "US", gdsRatio: 0.99, tdsRatio: 0.3, dscrRatio: 1.3, ltvPercent: 0.75 })
    );

    expect(result.scoreBreakdown.gds_score).toBe(0);
    // tds(=DTI) 25 + dscr 25 + ltv 25 = 75, scaled to /75*100 = 100 — a perfect score
    // despite an out-of-range gdsRatio, proving GDS truly isn't scored for US.
    expect(result.overallScore).toBe(100);
    expect(result.qualificationLikelihood).toBe("Likely bankable");
  });

  it("does not raise a GDS flagged issue for US even when gds_score is 0", () => {
    const result = calculateLenderScorecard(baseInput({ country: "US", gdsRatio: 0.99, tdsRatio: 0.3, dscrRatio: 1.3, ltvPercent: 0.75 }));

    expect(result.flaggedIssues.some((f) => f.startsWith("GDS"))).toBe(false);
  });
});

describe("calculateLenderScorecard — US, tdsRatio is scored as DTI", () => {
  const weakUS = baseInput({
    country: "US",
    tdsRatio: 0.45,
    dscrRatio: 0.9,
    ltvPercent: 0.97,
    creditScoreEstimate: 680,
  });
  const result = calculateLenderScorecard(weakUS);

  it("scores tdsRatio against the US DTI brackets and proportionally scales the 3-metric total to 0-100", () => {
    expect(result.scoreBreakdown).toEqual({ gds_score: 0, tds_score: 5, dscr_score: 5, ltv_score: 0 });
    // (5 + 5 + 0) / 75 * 100 = 13.33...
    expect(result.overallScore).toBeCloseTo((10 / 75) * 100, 4);
    expect(result.qualificationLikelihood).toBe("Unlikely without fixes");
  });

  it("labels the tds/DTI issue as 'DTI', not 'TDS', for US", () => {
    expect(result.flaggedIssues).toContain("DTI > 43% (threshold) — currently 45.0%.");
    expect(result.recommendations).toContain("Lower DTI by paying down other debt obligations or increasing qualifying income.");
  });

  it("uses the US LTV threshold (95%) in its issue text and the US down-payment target (90%) in its recommendation", () => {
    expect(result.flaggedIssues).toContain("LTV > 95% (threshold) — currently 97.0%.");
    expect(result.recommendations).toContain("Increase down payment to lower LTV below 90%.");
  });

  it("a borderline credit score (650-699) adds a flagged issue but no score deduction and no recommendation", () => {
    expect(result.creditScore_context).toBe("Borderline");
    expect(result.flaggedIssues).toContain(
      "Credit score of 680 is borderline (650-699) — no points deducted, but lenders may scrutinize further."
    );
    expect(result.recommendations.some((r) => r.includes("680"))).toBe(false);
  });

  it("summary's key issue names the worst-scoring metric (LTV) by its US label and value", () => {
    expect(result.summary).toBe("Overall score: 13/100. Unlikely without fixes. Key issue: LTV at 97.0% is below the lender-preferred threshold.");
  });
});

describe("calculateLenderScorecard — DSCR uses the same brackets in both countries", () => {
  it("an identical dscrRatio produces the same dscr_score for Canada and US", () => {
    const ca = calculateLenderScorecard(baseInput({ country: "Canada", dscrRatio: 1.1 }));
    const us = calculateLenderScorecard(baseInput({ country: "US", dscrRatio: 1.1 }));

    expect(ca.scoreBreakdown.dscr_score).toBe(15);
    expect(us.scoreBreakdown.dscr_score).toBe(15);
  });
});

describe("calculateLenderScorecard — LTV brackets differ by country", () => {
  it("85% LTV scores 20 in Canada (<=90% bracket... but above the 80% full-marks line) vs 25 in the US (<=80% bracket doesn't apply, falls to <=90%)", () => {
    const ca = calculateLenderScorecard(baseInput({ country: "Canada", ltvPercent: 0.85 }));
    const us = calculateLenderScorecard(baseInput({ country: "US", ltvPercent: 0.85 }));

    expect(ca.scoreBreakdown.ltv_score).toBe(10);
    expect(us.scoreBreakdown.ltv_score).toBe(20);
  });
});

describe("calculateLenderScorecard — credit score context brackets", () => {
  it.each([
    [760, "Strong history"],
    [710, "Acceptable"],
    [660, "Borderline"],
    [600, "May require explanation"],
  ])("a credit score of %d maps to '%s'", (score, expectedContext) => {
    const result = calculateLenderScorecard(baseInput({ creditScoreEstimate: score }));
    expect(result.creditScore_context).toBe(expectedContext);
  });
});

describe("calculateLenderScorecard — qualification likelihood brackets", () => {
  // Each combo's per-metric scores are hand-summed in the comment and checked
  // against Canada's bracket functions (gds/tds/dscr each 25|15|5|0, ltv 25|20|10|0)
  // to land unambiguously inside the target qualificationLikelihood band.
  it.each([
    // 25(gds<=0.32) + 25(tds<=0.40) + 25(dscr>=1.25) + 20(0.75<ltv<=0.80) = 95 -> >=80
    ["95 total", { gdsRatio: 0.3, tdsRatio: 0.38, dscrRatio: 1.3, ltvPercent: 0.78 }, "Likely bankable", 95],
    // 25(gds<=0.32) + 15(0.40<tds<=0.44) + 15(1.0<=dscr<1.25) + 10(0.80<ltv<=0.90) = 65 -> 60-79
    ["65 total", { gdsRatio: 0.3, tdsRatio: 0.42, dscrRatio: 1.1, ltvPercent: 0.85 }, "Borderline", 65],
    // 15(0.32<gds<=0.39) + 15(0.40<tds<=0.44) + 15(1.0<=dscr<1.25) + 0(ltv>0.90) = 45 -> 40-59
    ["45 total", { gdsRatio: 0.35, tdsRatio: 0.42, dscrRatio: 1.1, ltvPercent: 0.92 }, "May face difficulty", 45],
    // 5(0.39<gds<=0.45) + 5(0.44<tds<=0.50) + 5(0.8<=dscr<1.0) + 0(ltv>0.90) = 15 -> <40
    ["15 total", { gdsRatio: 0.42, tdsRatio: 0.48, dscrRatio: 0.85, ltvPercent: 0.95 }, "Unlikely without fixes", 15],
  ] as const)("%s maps to '%s'", (_label, inputs, expectedLikelihood, expectedScore) => {
    const result = calculateLenderScorecard(baseInput({ country: "Canada", ...inputs }));

    expect(result.overallScore).toBe(expectedScore);
    expect(result.qualificationLikelihood).toBe(expectedLikelihood);
  });
});

describe("calculateLenderScorecard — result structure", () => {
  it("returns every field defined on LenderScorecardResult", () => {
    const result = calculateLenderScorecard(baseInput());

    expect(result).toEqual(
      expect.objectContaining({
        overallScore: expect.any(Number),
        qualificationLikelihood: expect.any(String),
        scoreBreakdown: expect.objectContaining({
          gds_score: expect.any(Number),
          tds_score: expect.any(Number),
          dscr_score: expect.any(Number),
          ltv_score: expect.any(Number),
        }),
        creditScore_context: expect.any(String),
        flaggedIssues: expect.any(Array),
        recommendations: expect.any(Array),
        summary: expect.any(String),
      })
    );
  });

  it("propertyType does not affect the scoring math (no commercial/mixed_use threshold table exists)", () => {
    const residential = calculateLenderScorecard(baseInput({ propertyType: "residential" }));
    const commercial = calculateLenderScorecard(baseInput({ propertyType: "commercial" }));

    expect(commercial.overallScore).toBe(residential.overallScore);
  });
});
