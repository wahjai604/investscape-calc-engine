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

import { USQualifyingRentalIncomeInput, USQualifyingRentalIncomeResult } from "./types";
import { RENTAL_INCOME_HAIRCUT } from "./utils/constants";

/**
 * Fannie Mae Selling Guide B3-3.8-01 lease-based path only (v1 scope): 75%
 * of gross monthly rent counts toward qualifying income when a signed
 * lease exists. The Schedule E / 2-year-tax-return-history path (for
 * properties owned >=2 years) is a separate, Phase 2 calculation this
 * engine does not implement — it requires tax-return-history data this
 * build doesn't collect, not just different math.
 *
 * Correctly refuses to apply the 75% haircut without a signed lease,
 * rather than silently falling back to an unverified market-rent
 * estimate — there is no fallback path in v1, by design.
 */
export function calculateQualifyingRentalIncomeUS(
  input: USQualifyingRentalIncomeInput
): USQualifyingRentalIncomeResult {
  const { grossMonthlyRent, hasSignedLease } = input;

  if (!hasSignedLease) {
    return {
      qualifyingRentalIncome: null,
      haircutApplied: RENTAL_INCOME_HAIRCUT,
      methodology: "lease_based_75_percent",
      applied: false,
      issues: [
        "No signed lease on file — the 75% rule (Fannie Mae B3-3.8-01) requires a signed lease. The Schedule E / 2-year-tax-return-history path is Phase 2 and not available in this version. This engine does not substitute an unverified market-rent estimate; qualifyingRentalIncome is null.",
      ],
    };
  }

  return {
    qualifyingRentalIncome: grossMonthlyRent * RENTAL_INCOME_HAIRCUT,
    haircutApplied: RENTAL_INCOME_HAIRCUT,
    methodology: "lease_based_75_percent",
    applied: true,
    issues: [],
  };
}
