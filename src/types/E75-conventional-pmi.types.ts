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

export interface ConventionalPMIInput {
  loanAmount: number;
  downPaymentPercent: number;
  creditScore: number;
}

export interface ConventionalPMIResult {
  loanToValuePercent: number;
  pmiRequired: boolean;
  /** 0 exactly (not omitted/null) whenever pmiRequired is false. */
  annualPMIRate: number;
  annualPMIAmount: number;
  monthlyPMIAmount: number;
  /** The LTV threshold (PMI_REQUIRED_LTV_THRESHOLD) at/below which PMI becomes borrower-cancellable — informational, not itself a live cancellation calculation. */
  cancellableAtLTV: number;
  issues: string[];
}
