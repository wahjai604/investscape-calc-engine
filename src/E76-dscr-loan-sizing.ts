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
 * DO NOT CONFUSE WITH E9-dscr.ts. Both compute something called "DSCR",
 * and that is the entire danger: they are different ratios.
 *
 *   E9  (calculateDSCR / evaluateDSCR): net operating income / annual
 *       debt service — the commercial-lending convention.
 *   E76 (this file): gross monthly rent / monthly PITIA — the DSCR-LOAN
 *       underwriting convention non-QM investor lenders actually use.
 *       No personal income documentation, no personal DTI — qualification
 *       is based on this ratio alone.
 *
 * Same three letters, same general shape (income over obligation), but a
 * different numerator (gross rent vs. NOI) and a different denominator
 * (PITIA vs. total annual debt service). Displaying one and labelling it
 * the other is a real, documented error risk in this domain — every
 * export in this file keeps the "LoanConvention" qualifier for exactly
 * that reason, and it should never be dropped in the UI, docs, or API
 * layer built on top of this.
 */

import { LoanConventionDSCRInput, LoanConventionDSCRResult } from "./types";
import { DSCR_LOAN_MIN_RATIO_DEFAULT, DSCR_LOAN_STRONG_RATIO_THRESHOLD } from "./utils/constants";

export function calculateLoanConventionDSCR(grossMonthlyRent: number, monthlyPITIA: number): number {
  return grossMonthlyRent / monthlyPITIA;
}

export function evaluateLoanConventionDSCR(
  input: LoanConventionDSCRInput
): LoanConventionDSCRResult {
  const { grossMonthlyRent, monthlyPITIA, minimumRatioOverride, lenderAllowsNoRatioProgram = false } =
    input;

  const loanConventionDSCR = calculateLoanConventionDSCR(grossMonthlyRent, monthlyPITIA);
  const minimumRatioRequired = minimumRatioOverride ?? DSCR_LOAN_MIN_RATIO_DEFAULT;

  const belowStandardMinimum = loanConventionDSCR < minimumRatioRequired;
  const meetsMinimumRatio = !belowStandardMinimum;
  const qualifiesForBestTerms = loanConventionDSCR >= DSCR_LOAN_STRONG_RATIO_THRESHOLD;

  const issues: string[] = [];
  if (belowStandardMinimum) {
    issues.push(
      `Computed loan-convention DSCR of ${loanConventionDSCR.toFixed(3)} is below the ${minimumRatioRequired.toFixed(2)} minimum for this program.` +
        (lenderAllowsNoRatioProgram
          ? " lenderAllowsNoRatioProgram is set — some lenders offer sub-1.0 or 'no-ratio' programs where reserves substitute for a ratio floor, but that program's own qualification math is a named lender-specific exception, not modeled by this engine."
          : " Some lenders offer sub-1.0 or 'no-ratio' programs (reserves substitute for a ratio floor) as a named exception, not modeled by this engine — set lenderAllowsNoRatioProgram if evaluating one.")
    );
  }

  return {
    loanConventionDSCR,
    minimumRatioRequired,
    meetsMinimumRatio,
    qualifiesForBestTerms,
    belowStandardMinimum,
    issues,
  };
}
