/**
 * InvestScape™ Calculation Engine
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * InvestScape™ is a registered trademark of Lighthouse Research Ltd.
 * This software is proprietary and confidential.
 *
 * LICENSING:
 * - Personal/Educational Use: Permitted (see LICENSE)
 * - Commercial Use: Requires written Commercial License Agreement
 * Contact: eric@lighthouseresearch.ca
 *
 * DISCLAIMER:
 * This software is provided "as-is" for informational purposes only.
 * Not investment advice, tax advice, or financial advice.
 * Use at your own risk.
 */

import { DealGradeInput, DealGrade, DealGradeMetricBreakdown, DealGradeScoreBreakdown, DealGradeResult } from "./types";
import {
  CAP_RATE_STRONG_THRESHOLD,
  CAP_RATE_SOLID_THRESHOLD,
  CAP_RATE_WEAK_THRESHOLD,
  CASH_ON_CASH_STRONG_THRESHOLD,
  CASH_ON_CASH_SOLID_THRESHOLD,
  CASH_ON_CASH_WEAK_THRESHOLD,
  DSCR_STRONG_THRESHOLD,
  DSCR_SOLID_THRESHOLD,
  DSCR_WEAK_THRESHOLD,
  IRR_STRONG_THRESHOLD,
  IRR_SOLID_THRESHOLD,
  IRR_WEAK_THRESHOLD,
  DEAL_GRADE_A_MIN,
  DEAL_GRADE_B_PLUS_MIN,
  DEAL_GRADE_B_MIN,
  DEAL_GRADE_B_MINUS_MIN,
} from "./utils/constants";

/**
 * This is a NEW, deal-*quality* engine — distinct from
 * E25-lender-scorecard.ts's borrower-*bankability* score (GDS/TDS/DSCR/LTV
 * → qualification likelihood). It deliberately mirrors E25's real pattern
 * (weighted metric scoring → bracket → qualitative label, a MetricEvaluation-
 * style struct per metric, flaggedIssues/recommendations arrays) rather than
 * inventing a new shape, but answers a different question: "is this a good
 * deal" rather than "will a lender approve it". DSCR appears in both
 * engines because it's genuinely relevant to both questions — here it's one
 * of four equally-weighted signals, not the whole story.
 *
 * Weighting: no industry-standard scheme exists for combining cap rate /
 * cash-on-cash / DSCR / IRR into a single grade, so asserting an unequal
 * weighting (e.g. "IRR matters more than cap rate") would be a false
 * precision this codebase has no source for. All four metrics get equal
 * 25-point weight, mirroring E25's own four-equal-metric Canada case.
 */

function scoreCapRate(capRate: number): number {
  if (capRate >= CAP_RATE_STRONG_THRESHOLD) return 25;
  if (capRate >= CAP_RATE_SOLID_THRESHOLD) return 15;
  if (capRate >= CAP_RATE_WEAK_THRESHOLD) return 5;
  return 0;
}

function scoreCashOnCash(cashOnCash: number): number {
  if (cashOnCash >= CASH_ON_CASH_STRONG_THRESHOLD) return 25;
  if (cashOnCash >= CASH_ON_CASH_SOLID_THRESHOLD) return 15;
  if (cashOnCash >= CASH_ON_CASH_WEAK_THRESHOLD) return 5;
  return 0;
}

function scoreDSCR(dscr: number): number {
  if (dscr >= DSCR_STRONG_THRESHOLD) return 25;
  if (dscr >= DSCR_SOLID_THRESHOLD) return 15;
  if (dscr >= DSCR_WEAK_THRESHOLD) return 5;
  return 0;
}

function scoreIRR(irr: number): number {
  if (irr >= IRR_STRONG_THRESHOLD) return 25;
  if (irr >= IRR_SOLID_THRESHOLD) return 15;
  if (irr >= IRR_WEAK_THRESHOLD) return 5;
  return 0;
}

function gradeForScore(overallScore: number): DealGrade {
  if (overallScore >= DEAL_GRADE_A_MIN) return "A";
  if (overallScore >= DEAL_GRADE_B_PLUS_MIN) return "B+";
  if (overallScore >= DEAL_GRADE_B_MIN) return "B";
  if (overallScore >= DEAL_GRADE_B_MINUS_MIN) return "B-";
  return "C";
}

function percentText(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function evaluateCapRate(capRate: number | null): DealGradeMetricBreakdown {
  if (capRate === null) return { label: "Cap Rate", valueText: "Insufficient data", score: null };
  return { label: "Cap Rate", valueText: percentText(capRate), score: scoreCapRate(capRate) };
}

function evaluateCashOnCash(cashOnCash: number | null): DealGradeMetricBreakdown {
  if (cashOnCash === null) return { label: "Cash-on-Cash", valueText: "Insufficient data", score: null };
  return { label: "Cash-on-Cash", valueText: percentText(cashOnCash), score: scoreCashOnCash(cashOnCash) };
}

function evaluateDSCRMetric(dscr: number | null): DealGradeMetricBreakdown {
  if (dscr === null) return { label: "DSCR", valueText: "Insufficient data", score: null };
  return { label: "DSCR", valueText: dscr.toFixed(2), score: scoreDSCR(dscr) };
}

function evaluateIRR(irr: number | null): DealGradeMetricBreakdown {
  if (irr === null) return { label: "IRR", valueText: "Insufficient data", score: null };
  return { label: "IRR", valueText: percentText(irr), score: scoreIRR(irr) };
}

function buildIssuesAndRecommendations(input: DealGradeInput, breakdown: DealGradeScoreBreakdown): {
  flaggedIssues: string[];
  recommendations: string[];
} {
  const flaggedIssues: string[] = [];
  const recommendations: string[] = [];

  for (const metric of Object.values(breakdown)) {
    if (metric.score === null) {
      flaggedIssues.push(`${metric.label}: insufficient data to score this metric — excluded from the overall grade.`);
    }
  }

  if (input.cashOnCash !== null && input.cashOnCash < 0) {
    flaggedIssues.push(`Negative cash flow — cash-on-cash is ${percentText(input.cashOnCash)}.`);
    recommendations.push("Improve cash-on-cash through higher rent, lower expenses, or a lower purchase price/down payment.");
  } else if (breakdown.cashOnCash.score !== null && breakdown.cashOnCash.score <= 5) {
    recommendations.push("Improve cash-on-cash through higher rent, lower expenses, or improved financing terms.");
  }

  if (input.dscr !== null && input.dscr < 1.0) {
    flaggedIssues.push(`DSCR below 1.0 — NOI does not cover debt service (currently ${input.dscr.toFixed(2)}).`);
    recommendations.push("Raise DSCR through higher rent, lower expenses, or a smaller/cheaper loan before proceeding.");
  } else if (breakdown.dscr.score !== null && breakdown.dscr.score <= 5) {
    recommendations.push("DSCR has little cushion above 1.0 — a small rent or expense swing could turn cash flow negative.");
  }

  if (breakdown.capRate.score !== null && breakdown.capRate.score <= 5) {
    flaggedIssues.push(`Cap rate is below the ${percentText(CAP_RATE_WEAK_THRESHOLD)} weak-deal threshold — currently ${breakdown.capRate.valueText}.`);
    recommendations.push("Cap rate is thin — reconsider purchase price or look for higher-NOI comparables.");
  }

  if (breakdown.irr.score !== null && breakdown.irr.score <= 5) {
    flaggedIssues.push(`Projected IRR is below the ${percentText(IRR_WEAK_THRESHOLD)} weak-deal threshold — currently ${breakdown.irr.valueText}.`);
    recommendations.push("Full-cycle return looks weak — revisit hold period, exit assumptions, or financing structure.");
  }

  return { flaggedIssues, recommendations };
}

/**
 * Scores a deal's quality on four equally-weighted metrics — Cap Rate,
 * Cash-on-Cash, DSCR, and IRR — into a 0-100 overallScore and an
 * A/B+/B/B-/C letter grade. One function, callable identically from
 * Property Detail (a saved/owned property, computing these four numbers
 * from real trailing performance) and Deal Analyzer (an analyzed-but-
 * unowned deal, computing them from projections) — the grading logic itself
 * doesn't know or care which.
 *
 * A metric with insufficient data (null) is excluded from both the
 * numerator and denominator of overallScore and rescaled proportionally —
 * the same precedent E25-lender-scorecard.ts's US branch already sets for
 * its missing GDS slot — rather than being silently treated as a 0, which
 * would be indistinguishable from a real, terrible value.
 */
export function calculateDealGrade(input: DealGradeInput): DealGradeResult {
  const scoreBreakdown: DealGradeScoreBreakdown = {
    capRate: evaluateCapRate(input.capRate),
    cashOnCash: evaluateCashOnCash(input.cashOnCash),
    dscr: evaluateDSCRMetric(input.dscr),
    irr: evaluateIRR(input.irr),
  };

  const scoredMetrics = Object.values(scoreBreakdown).filter(
    (m): m is DealGradeMetricBreakdown & { score: number } => m.score !== null,
  );
  const fullyScored = scoredMetrics.length === 4;

  const rawScore = scoredMetrics.reduce((sum, m) => sum + m.score, 0);
  const maxPossible = scoredMetrics.length * 25;
  const overallScore = maxPossible === 0 ? 0 : (rawScore / maxPossible) * 100;

  const grade = gradeForScore(overallScore);
  const { flaggedIssues, recommendations } = buildIssuesAndRecommendations(input, scoreBreakdown);

  const dataNote = fullyScored ? "" : " (partial data — some metrics excluded)";
  const summary = `Deal grade: ${grade} (${overallScore.toFixed(0)}/100)${dataNote}.`;

  return { overallScore, grade, scoreBreakdown, fullyScored, flaggedIssues, recommendations, summary };
}
