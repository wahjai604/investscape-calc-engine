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

export interface FHAMIPInput {
  loanAmount: number;
  downPaymentPercent: number;
  /** Buckets internally to the fifteenYear tier at <=15, otherwise thirtyYear — FHA MIP tables only distinguish those two terms. */
  amortizationYears: number;
  isHighCostArea: boolean;
}

export interface FHAMIPResult {
  upfrontMIPRate: number;
  upfrontMIPAmount: number;
  annualMIPRate: number;
  annualMIPAmount: number;
  monthlyMIPAmount: number;
  /** true when downPaymentPercent >= FHA_MIP_ELEVEN_YEAR_REMOVAL_MIN_DOWN_PAYMENT (post-2013 rule). */
  automaticRemovalEligible: boolean;
  /** FHA_MIP_AUTOMATIC_REMOVAL_YEARS when eligible, null otherwise. */
  automaticRemovalAfterYears: number | null;
  /** true whenever automaticRemovalEligible is false — MIP runs for the life of the loan with no removal path modeled here (borrower-requested refinance aside, which is out of scope). */
  isLifeOfLoan: boolean;
  issues: string[];
}
