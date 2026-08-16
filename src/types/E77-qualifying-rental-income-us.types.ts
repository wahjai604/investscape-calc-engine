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

export interface USQualifyingRentalIncomeInput {
  grossMonthlyRent: number;
  /** Required to apply the 75% rule at all — v1 only implements the lease-based path (Fannie Mae B3-3.8-01). The Schedule E / 2-year-tax-return path is Phase 2 and not modeled here. */
  hasSignedLease: boolean;
}

export interface USQualifyingRentalIncomeResult {
  /** null when hasSignedLease is false — never a fallback estimate. */
  qualifyingRentalIncome: number | null;
  /** Echoes RENTAL_INCOME_HAIRCUT (0.75) for audit-trail transparency. */
  haircutApplied: number;
  methodology: "lease_based_75_percent";
  applied: boolean;
  issues: string[];
}
