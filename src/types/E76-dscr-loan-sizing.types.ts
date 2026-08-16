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

/**
 * "LoanConvention" naming is deliberate throughout this file: this is the
 * DSCR-loan-underwriting ratio (gross rent / PITIA), NOT E9-dscr.ts's
 * calculateDSCR/evaluateDSCR (net operating income / annual debt service,
 * the commercial convention). Same three letters, different numerator,
 * different denominator, different use case — see E76-dscr-loan-sizing.ts
 * for the full explanation. Never rename these to plain "DSCR" anywhere
 * this type is consumed (UI, docs, API) without keeping that qualifier.
 */
export interface LoanConventionDSCRInput {
  grossMonthlyRent: number;
  /** Principal + Interest + Taxes + Insurance + Association dues — the full loan-underwriting payment stack, not just P&I. */
  monthlyPITIA: number;
  /** Overrides DSCR_LOAN_MIN_RATIO_DEFAULT when supplied (admin-editable per deal/lender). */
  minimumRatioOverride?: number;
  /** Some lenders offer sub-1.0 or "no-ratio" programs (reserves substitute for a ratio floor). Defaults to false — this is a named lender-specific exception, not the default assumption. */
  lenderAllowsNoRatioProgram?: boolean;
}

export interface LoanConventionDSCRResult {
  /** grossMonthlyRent / monthlyPITIA. */
  loanConventionDSCR: number;
  minimumRatioRequired: number;
  meetsMinimumRatio: boolean;
  /** true when loanConventionDSCR >= DSCR_LOAN_STRONG_RATIO_THRESHOLD — informational pricing signal, not a second qualify/no-qualify gate. */
  qualifiesForBestTerms: boolean;
  /** true whenever the computed ratio is below minimumRatioRequired, regardless of lenderAllowsNoRatioProgram. */
  belowStandardMinimum: boolean;
  issues: string[];
}
