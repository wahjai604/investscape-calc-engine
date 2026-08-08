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
