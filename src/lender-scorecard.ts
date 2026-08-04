export type LenderCountry = "Canada" | "US";
export type LoanType = "conventional" | "insured" | "portfolio";
export type LenderPropertyType = "residential" | "commercial" | "mixed_use";

export interface LenderScorecardInput {
  /** 0.35 for 35%. */
  gdsRatio: number;
  /** 0.40 for 40%. For US, this is used as the DTI figure ("DTI (similar to TDS)" per the E28 spec) — there's no separate dtiRatio field. */
  tdsRatio: number;
  dscrRatio: number;
  /** 0.85 for 85% LTV. */
  ltvPercent: number;
  /** Rough estimate or actual score. */
  creditScoreEstimate: number;
  country: LenderCountry;
  loanType: LoanType;
  /**
   * No commercial/mixed_use-specific threshold table exists anywhere in
   * the E28 spec, so this doesn't change the scoring math — the same
   * country-level GDS/TDS/DSCR/LTV brackets apply regardless of
   * propertyType. It's still echoed through for context.
   */
  propertyType: LenderPropertyType;
}

export type QualificationLikelihood = "Likely bankable" | "Borderline" | "May face difficulty" | "Unlikely without fixes";
export type CreditScoreContext = "Strong history" | "Acceptable" | "Borderline" | "May require explanation";

export interface ScoreBreakdown {
  /**
   * US: always 0 — GDS is "not standard US" per the E28 spec, and is
   * excluded from both the numerator and denominator of overallScore
   * (see calculateLenderScorecard's JSDoc), not merely displayed as 0
   * while still counting. This is a display placeholder for "not scored",
   * not a penalized bracket outcome.
   */
  gds_score: number;
  /** US: this is the DTI score (scored against the DTI brackets, using tdsRatio as the DTI figure) — there's no separate dti_score field. */
  tds_score: number;
  dscr_score: number;
  ltv_score: number;
}

export interface LenderScorecardResult {
  /** 0-100. */
  overallScore: number;
  qualificationLikelihood: QualificationLikelihood;
  scoreBreakdown: ScoreBreakdown;
  creditScore_context: string;
  flaggedIssues: string[];
  recommendations: string[];
  summary: string;
}

function gdsScoreCanada(gds: number): number {
  if (gds <= 0.32) return 25;
  if (gds <= 0.39) return 15;
  if (gds <= 0.45) return 5;
  return 0;
}

function tdsScoreCanada(tds: number): number {
  if (tds <= 0.4) return 25;
  if (tds <= 0.44) return 15;
  if (tds <= 0.5) return 5;
  return 0;
}

function dtiScoreUS(dti: number): number {
  if (dti <= 0.36) return 25;
  if (dti <= 0.43) return 15;
  if (dti <= 0.5) return 5;
  return 0;
}

/** Same brackets for both countries. */
function dscrScore(dscr: number): number {
  if (dscr >= 1.25) return 25;
  if (dscr >= 1.0) return 15;
  if (dscr >= 0.8) return 5;
  return 0;
}

function ltvScoreCanada(ltv: number): number {
  if (ltv <= 0.75) return 25;
  if (ltv <= 0.8) return 20;
  if (ltv <= 0.9) return 10;
  return 0;
}

function ltvScoreUS(ltv: number): number {
  if (ltv <= 0.8) return 25;
  if (ltv <= 0.9) return 20;
  if (ltv <= 0.95) return 10;
  return 0;
}

function qualificationLikelihoodFor(overallScore: number): QualificationLikelihood {
  if (overallScore >= 80) return "Likely bankable";
  if (overallScore >= 60) return "Borderline";
  if (overallScore >= 40) return "May face difficulty";
  return "Unlikely without fixes";
}

function creditScoreContextFor(creditScoreEstimate: number): CreditScoreContext {
  if (creditScoreEstimate >= 750) return "Strong history";
  if (creditScoreEstimate >= 700) return "Acceptable";
  if (creditScoreEstimate >= 650) return "Borderline";
  return "May require explanation";
}

interface MetricEvaluation {
  label: string;
  valueText: string;
  score: number;
  /** Only present for scores of 5 or 0 — the "issue" tier. */
  issueText?: string;
  /** Only present alongside issueText. */
  recommendationText?: string;
}

function buildFlagsAndRecommendations(metrics: MetricEvaluation[]): { flaggedIssues: string[]; recommendations: string[] } {
  const flaggedIssues: string[] = [];
  const recommendations: string[] = [];

  for (const metric of metrics) {
    if (metric.issueText) flaggedIssues.push(metric.issueText);
    if (metric.recommendationText) recommendations.push(metric.recommendationText);
  }

  return { flaggedIssues, recommendations };
}

/**
 * overallScore: Canada sums all four metrics (GDS/TDS/DSCR/LTV), each
 * 0-25, for a natural 0-100 range. The US only has three real metrics —
 * GDS is explicitly "not standard US" — so those three are summed (max
 * 75) and scaled proportionally onto 0-100 (raw / 75 × 100), rather than
 * awarding the missing GDS slot automatic full marks. This was a genuine
 * ambiguity in the E28 spec (its own worked examples for the Borderline
 * Canada and Weak US test cases don't reproduce under a literal bracket
 * sum — see the conversation) resolved this way per explicit confirmation;
 * the "~65"/"~40" example scores in the spec are approximate narrative
 * color, not exact targets this implementation reproduces.
 */
export function calculateLenderScorecard(input: LenderScorecardInput): LenderScorecardResult {
  const isCanada = input.country === "Canada";

  const dscr_score = dscrScore(input.dscrRatio);
  const ltv_score = isCanada ? ltvScoreCanada(input.ltvPercent) : ltvScoreUS(input.ltvPercent);
  const tds_score = isCanada ? tdsScoreCanada(input.tdsRatio) : dtiScoreUS(input.tdsRatio);
  const gds_score = isCanada ? gdsScoreCanada(input.gdsRatio) : 0;

  const overallScore = isCanada
    ? gds_score + tds_score + dscr_score + ltv_score
    : ((tds_score + dscr_score + ltv_score) / 75) * 100;

  const scoreBreakdown: ScoreBreakdown = { gds_score, tds_score, dscr_score, ltv_score };
  const qualificationLikelihood = qualificationLikelihoodFor(overallScore);
  const creditScore_context = creditScoreContextFor(input.creditScoreEstimate);

  const metrics: MetricEvaluation[] = [];

  if (isCanada) {
    metrics.push({
      label: "GDS",
      valueText: `${(input.gdsRatio * 100).toFixed(1)}%`,
      score: gds_score,
      issueText: gds_score <= 5 ? `GDS > 39% (threshold) — currently ${(input.gdsRatio * 100).toFixed(1)}%.` : undefined,
      recommendationText: gds_score <= 5 ? "Lower GDS by reducing the mortgage payment or increasing qualifying income." : undefined,
    });
    metrics.push({
      label: "TDS",
      valueText: `${(input.tdsRatio * 100).toFixed(1)}%`,
      score: tds_score,
      issueText: tds_score <= 5 ? `TDS > 44% (threshold) — currently ${(input.tdsRatio * 100).toFixed(1)}%.` : undefined,
      recommendationText: tds_score <= 5 ? "Lower TDS by paying down other debt obligations." : undefined,
    });
  } else {
    metrics.push({
      label: "DTI",
      valueText: `${(input.tdsRatio * 100).toFixed(1)}%`,
      score: tds_score,
      issueText: tds_score <= 5 ? `DTI > 43% (threshold) — currently ${(input.tdsRatio * 100).toFixed(1)}%.` : undefined,
      recommendationText: tds_score <= 5 ? "Lower DTI by paying down other debt obligations or increasing qualifying income." : undefined,
    });
  }

  metrics.push({
    label: "DSCR",
    valueText: input.dscrRatio.toFixed(2),
    score: dscr_score,
    issueText: dscr_score <= 5 ? `DSCR < 1.0 (cash flow negative) — currently ${input.dscrRatio.toFixed(2)}.` : undefined,
    recommendationText: dscr_score <= 5 ? "Improve DSCR through higher rent or lower expenses." : undefined,
  });

  const ltvThresholdText = isCanada ? "80%" : "90%";
  metrics.push({
    label: "LTV",
    valueText: `${(input.ltvPercent * 100).toFixed(1)}%`,
    score: ltv_score,
    issueText: ltv_score <= 5 ? `LTV > ${isCanada ? "90%" : "95%"} (threshold) — currently ${(input.ltvPercent * 100).toFixed(1)}%.` : undefined,
    recommendationText:
      ltv_score <= 5 ? `Increase down payment to lower LTV below ${ltvThresholdText}.` : undefined,
  });

  const { flaggedIssues, recommendations } = buildFlagsAndRecommendations(metrics);

  if (creditScore_context === "Borderline") {
    flaggedIssues.push(`Credit score of ${input.creditScoreEstimate} is borderline (650-699) — no points deducted, but lenders may scrutinize further.`);
  }
  if (creditScore_context === "May require explanation") {
    recommendations.push(`Credit score of ${input.creditScoreEstimate} is below 650 and may require a written explanation or credit-repair plan before approval.`);
  }

  const worstMetric = metrics.reduce((worst, m) => (m.score < worst.score ? m : worst), metrics[0]);
  const keyIssueText =
    worstMetric.score >= 25
      ? "No major issues identified."
      : `Key issue: ${worstMetric.label} at ${worstMetric.valueText} is below the lender-preferred threshold.`;

  const summary = `Overall score: ${overallScore.toFixed(0)}/100. ${qualificationLikelihood}. ${keyIssueText}`;

  return { overallScore, qualificationLikelihood, scoreBreakdown, creditScore_context, flaggedIssues, recommendations, summary };
}
