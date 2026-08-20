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

export type DealGrade = "A" | "B+" | "B" | "B-" | "C";

/**
 * The four metrics this engine grades — each is a number already produced
 * by an existing engine (calculateCapRate/calculateCashOnCash/calculateDSCR
 * from E9-dscr.ts, calculateIRR from E5-returns.ts), not recomputed here.
 * calculateDealGrade() only scores them; Property Detail and Deal Analyzer
 * each compute these four numbers their own way (a saved property has real
 * trailing NOI and debt service, an analyzed-but-unowned deal has projected
 * figures) and call the same grading function with the result.
 */
export interface DealGradeInput {
  /** NOI / purchasePrice, from calculateCapRate(). null when there's no reliable NOI/purchasePrice pair to compute it from — NOT 0, which is a real (terrible) cap rate, not "unknown". */
  capRate: number | null;
  /** firstYearNetCashFlow / equityInvested, from calculateCashOnCash(). null when insufficient data (e.g. equity invested isn't known yet). */
  cashOnCash: number | null;
  /** NOI / annualDebtService, from calculateDSCR()/evaluateDSCR() — same figure E25-lender-scorecard.ts uses for bankability, here treated as one signal among four for deal *quality*, not a standalone score. null when insufficient data. */
  dscr: number | null;
  /** Full-cycle IRR, from calculateIRR(). null when there's no multi-year cash-flow-plus-exit projection to run it against. Callers must normalize calculateIRR()'s NaN-on-no-solution result to null themselves — NaN should never reach this function. */
  irr: number | null;
}

export interface DealGradeMetricBreakdown {
  label: string;
  valueText: string;
  /** 0-25 (see the CAP_RATE / CASH_ON_CASH / DSCR / IRR threshold constants in utils/constants.ts). null when this metric had insufficient data — excluded from both the numerator and denominator of overallScore, never counted as a 0. */
  score: number | null;
}

export interface DealGradeScoreBreakdown {
  capRate: DealGradeMetricBreakdown;
  cashOnCash: DealGradeMetricBreakdown;
  dscr: DealGradeMetricBreakdown;
  irr: DealGradeMetricBreakdown;
}

export interface DealGradeResult {
  /** 0-100, rescaled proportionally over however many metrics had usable data (same "exclude, don't zero-weight" precedent E25-lender-scorecard.ts's US branch already sets for its missing GDS slot). */
  overallScore: number;
  grade: DealGrade;
  scoreBreakdown: DealGradeScoreBreakdown;
  /** False once any metric was null (insufficient data) — signals to the UI that overallScore is a partial-data rescale, not a full 4-metric score. */
  fullyScored: boolean;
  flaggedIssues: string[];
  recommendations: string[];
  summary: string;
}
